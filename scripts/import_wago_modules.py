"""
Import WAGO module/coupler renderings + LED layouts from a local WAGO-IO-CHECK 3
installation into MIAS-IO.

For each `.wdd` config file in WAGO-IO-CHECK's Config/{Coupler,Terminal} dirs:

1. Parse the INI-format metadata (article number, descriptions, bitmap, LED layout,
   bus-current draw, settings tool).
2. Resolve the front-panel BMP from Image/{Coupler,Terminal}.
3. Convert the BMP to PNG and save to `public/wago-modules/<articleNumber>.png`.
4. Build an aggregate JSON at `data/wago/wago_modules.json` keyed by article number.

Multiple WDDs can share one BMP (variant configs of the same hardware). The PNG
file is named by the canonical 4-digit article number stem; variants with parameter
suffixes (e.g. `07500404_00060000.wdd`) reuse the same PNG.

Run:  python scripts/import_wago_modules.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image  # Pillow

WAGO_ROOT = Path(r"C:/Program Files (x86)/WAGO Software/WAGO-IO-CHECK 3")
CONFIG_DIRS = {"Coupler": WAGO_ROOT / "Config" / "Coupler", "Terminal": WAGO_ROOT / "Config" / "Terminal"}
IMAGE_DIRS = {"Coupler": WAGO_ROOT / "Image" / "Coupler", "Terminal": WAGO_ROOT / "Image" / "Terminal"}

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_OUT_DIR = REPO_ROOT / "public" / "wago-modules"
JSON_OUT = REPO_ROOT / "data" / "wago" / "wago_modules.json"


def parse_wdd(path: Path) -> dict[str, Any]:
    """Parse a .wdd INI-style file. Returns {section: {key: value, ...}, "_raw_leds": [...]}.

    Section header: `[Common]`, `[LED]`, `[SETTINGS]`, etc.
    Key-value: `Article-NO    = 0750-0658` (whitespace around = trimmed).
    LED rows: `LED_NN  = COLOR, FLAG, LABEL` — kept as ordered list.
    """
    sections: dict[str, dict[str, str]] = {}
    leds: list[dict[str, Any]] = []
    section: str | None = None
    text = path.read_text(encoding="latin-1", errors="replace")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("-") or line.startswith(";") or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            sections.setdefault(section, {})
            continue
        if section is None:
            continue
        if "=" not in line:
            continue
        key, _, raw_val = line.partition("=")
        key = key.strip()
        val = raw_val.strip()
        if section == "LED" and re.match(r"^LED_\d+$", key):
            # parts are comma separated, with whitespace
            parts = [p.strip() for p in val.split(",")]
            color = parts[0] if parts else ""
            flag = parts[1] if len(parts) > 1 else ""
            label = parts[2] if len(parts) > 2 else ""
            leds.append({
                "index": int(key.split("_")[1]),
                "color": color,
                "flag": flag,
                "label": None if label in ("-1", "") else label,
            })
            continue
        sections[section][key] = val
    return {"sections": sections, "leds": sorted(leds, key=lambda x: x["index"])}


def article_to_canonical(art_field: str) -> str | None:
    """Normalize Article-NO to canonical mias-io form '750-1405'.

    Input variants: "0750-0658", "750-8210", "750-1405".
    """
    if not art_field:
        return None
    # Strip leading zeros from each part
    parts = art_field.split("-")
    if len(parts) != 2:
        return None
    a, b = parts
    a = str(int(a)) if a.isdigit() else a
    b = str(int(b)) if b.isdigit() else b
    return f"{a}-{b}"


def parse_int_or_none(val: str | None) -> int | None:
    if val is None:
        return None
    val = val.strip()
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None


def convert_bmp_to_png(bmp_path: Path, png_path: Path) -> tuple[int, int]:
    """Convert a BMP to PNG. Returns (width, height) of the image."""
    with Image.open(bmp_path) as im:
        # Some BMPs are palette-mode; convert to RGBA so PNG transparency is well-defined
        if im.mode == "P":
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA", "L"):
            im = im.convert("RGB")
        png_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(png_path, format="PNG", optimize=True)
        return im.size


def main() -> int:
    PNG_OUT_DIR.mkdir(parents=True, exist_ok=True)
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)

    modules: dict[str, dict[str, Any]] = {}
    bmp_to_png_cache: dict[str, tuple[str, int, int]] = {}

    seen = 0
    skipped_variants = 0
    no_image = 0

    for kind, cfg_dir in CONFIG_DIRS.items():
        if not cfg_dir.is_dir():
            print(f"WARN: missing {cfg_dir}", file=sys.stderr)
            continue
        img_dir = IMAGE_DIRS[kind]
        for wdd in sorted(cfg_dir.glob("*.wdd")):
            seen += 1

            # Skip variant configs (parameter suffixes — same hardware, different config)
            # Examples: 07500404_00060000.wdd, 07500404_K0197576.wdd
            stem = wdd.stem
            if "_" in stem and not stem.endswith("o") and not stem.endswith("w"):
                # Variant suffix — use the base config for canonical metadata
                base_stem = stem.split("_")[0]
                if (cfg_dir / f"{base_stem}.wdd").exists():
                    skipped_variants += 1
                    continue

            parsed = parse_wdd(wdd)
            common = parsed["sections"].get("Common", {})
            led_section = parsed["sections"].get("LED", {})

            article = article_to_canonical(common.get("Article-NO", ""))
            if not article:
                continue

            # Resolve bitmap. Couplers default to <stem>.bmp; Terminals get explicit Bitmap=
            bmp_name = common.get("Bitmap", "").strip()
            if not bmp_name:
                bmp_name = f"{stem}.bmp"
            bmp_path = img_dir / bmp_name
            if not bmp_path.is_file():
                no_image += 1
                # Still capture metadata even if image is missing
                image_record = None
            else:
                # Reuse PNG if multiple articles share same BMP
                if bmp_name not in bmp_to_png_cache:
                    # Name PNG by article number for the canonical mapping
                    png_name = f"{article}.png"
                    png_path = PNG_OUT_DIR / png_name
                    try:
                        w, h = convert_bmp_to_png(bmp_path, png_path)
                        bmp_to_png_cache[bmp_name] = (png_name, w, h)
                    except Exception as e:
                        print(f"FAIL convert {bmp_path}: {e}", file=sys.stderr)
                        no_image += 1
                        image_record = None
                        bmp_to_png_cache[bmp_name] = None  # type: ignore
                else:
                    cached = bmp_to_png_cache[bmp_name]
                    if cached is not None:
                        # Articles sharing one BMP get separate PNG copies (cheap, simpler URL contract)
                        png_name = f"{article}.png"
                        png_path = PNG_OUT_DIR / png_name
                        if not png_path.exists():
                            try:
                                w, h = convert_bmp_to_png(bmp_path, png_path)
                            except Exception as e:
                                print(f"FAIL convert {bmp_path}: {e}", file=sys.stderr)
                                continue
                        else:
                            w, h = cached[1], cached[2]
                        bmp_to_png_cache[bmp_name] = (png_name, w, h)

                cached = bmp_to_png_cache.get(bmp_name)
                if cached is None:
                    image_record = None
                else:
                    image_record = {
                        "url": f"/wago-modules/{article}.png",
                        "width": cached[1],
                        "height": cached[2],
                        "sourceBmp": bmp_name,
                    }

            # LED layout
            led_record: dict[str, Any] | None = None
            if led_section or parsed["leds"]:
                led_record = {
                    "rows": parse_int_or_none(led_section.get("LEDROWS")),
                    "cols": parse_int_or_none(led_section.get("LEDCOLS")),
                    "max": parse_int_or_none(led_section.get("LEDMAX")),
                    "rect": led_section.get("LEDRECT"),  # raw "x1,y1,x2,y2" string
                    "items": parsed["leds"],
                }

            # Build the canonical record
            record: dict[str, Any] = {
                "articleNumber": article,
                "kind": kind.lower(),  # "coupler" | "terminal"
                "descriptions": {
                    "en": common.get("DescriptionEN", "").strip() or None,
                    "de": common.get("DescriptionDE", "").strip() or None,
                    "fr": common.get("DescriptionFR", "").strip() or None,
                },
                "moduleType": parse_int_or_none(common.get("ModuleType")),
                "moduleIcon": parse_int_or_none(common.get("ModuleIcon")),
                "supportedModes": parse_int_or_none(common.get("SupportedModes")),
                "bootDelayS": parse_int_or_none(common.get("BOOTDELAY")),
                "consumptionMa": parse_int_or_none(common.get("Consumption")),
                "voltageV": parse_int_or_none(common.get("Voltage")),
                "lk1": parse_int_or_none(common.get("LK1")),
                "lk2": parse_int_or_none(common.get("LK2")),
                "pe": parse_int_or_none(common.get("PE")),
                "adjustable": (common.get("Adjustable", "").strip() == "1"),
                "settingsApp": common.get("SettingsApp", "").strip() or None,
                "settingsAppName": common.get("SettingsAppName", "").strip() or None,
                "image": image_record,
                "leds": led_record,
                "source": {
                    "wddFile": wdd.name,
                    "wddSection": kind,
                },
            }

            modules[article] = record

    # Write the aggregate JSON
    JSON_OUT.write_text(
        json.dumps(modules, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )

    print(f"Parsed {seen} WDD files, skipped {skipped_variants} parameter variants.")
    print(f"Modules captured: {len(modules)}")
    print(f"Images converted: {sum(1 for v in bmp_to_png_cache.values() if v is not None)} unique BMPs")
    if no_image:
        print(f"WARN: {no_image} entries had no matching image.")
    print(f"Wrote PNG -> {PNG_OUT_DIR}")
    print(f"Wrote JSON -> {JSON_OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

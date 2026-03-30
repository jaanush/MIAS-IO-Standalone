import { existsSync, mkdirSync, accessSync, constants } from "fs";
import { join } from "path";

const PRIMARY = join(process.cwd(), "storage", "plugin");
const FALLBACK = join("/tmp", "mias-plugin-storage");

function isWritable(dir: string): boolean {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolved storage directory — uses /tmp fallback if primary isn't writable */
export const STORAGE_DIR = isWritable(PRIMARY) ? PRIMARY : (() => {
  mkdirSync(FALLBACK, { recursive: true });
  return FALLBACK;
})();

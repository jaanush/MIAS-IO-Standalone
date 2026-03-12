-- ============================================================
-- Tag generation for LasseMaja (project_id = 1)
-- Updates ALL signal tags using the Älveli naming pattern:
--   {System_Name}_{numeric_code}_{component_suffix}_{Description}
--
-- Rules:
--   - System name: strip trailing "(NNN)" parenthetical, Title_Case each word
--   - Abbreviation exception: all-caps words ≤3 chars stay uppercase (FWD, AFT, DC, WH…)
--   - Numeric code: from component_tag prefix (e.g. "831-TT001" → 831)
--                   falls back to signal_system.code if it is a plain number
--   - Component suffix: part after "NNN-", sanitised (/, :, spaces → _)
--   - Description: same Title_Case + sanitise rules
--   - Duplicates within the project get _2, _3 … suffix
-- ============================================================

-- Helper: format a single word (abbreviation-aware)
CREATE OR REPLACE FUNCTION _mias_fmt_word(w text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF w IS NULL OR w = '' THEN RETURN ''; END IF;
    -- Short all-caps alpha tokens (≤3 chars) are abbreviations: keep as-is
    -- Examples: FWD, AFT, DC, AC, WH, NO, DO
    IF length(w) <= 3 AND w ~ '^[A-Z]+$' THEN RETURN w; END IF;
    -- Otherwise: first letter upper, rest lower
    RETURN initcap(lower(w));
END;
$$;

-- Helper: sanitize + format a text string (spaces/special chars → _, title-cased words)
CREATE OR REPLACE FUNCTION _mias_fmt_text(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    parts  text[];
    part   text;
    result text := '';
BEGIN
    IF t IS NULL OR t = '' THEN RETURN ''; END IF;
    parts := regexp_split_to_array(trim(t), '[^a-zA-Z0-9]+');
    FOREACH part IN ARRAY parts LOOP
        IF part = '' THEN CONTINUE; END IF;
        IF result <> '' THEN result := result || '_'; END IF;
        result := result || _mias_fmt_word(part);
    END LOOP;
    RETURN result;
END;
$$;

-- ============================================================
-- DRY RUN — review before applying
-- ============================================================
SELECT
    s.id,
    s.tag                                      AS current_tag,
    s.origin,
    ss.name                                    AS system_name,
    s.component_tag,
    s.description,
    -- preview generated tag inline
    trim(both '_' from regexp_replace(
        concat_ws('_',
            nullif(
                _mias_fmt_text(regexp_replace(coalesce(ss.name,''), '\s*\([^)]*\)\s*$','')),
            ''),
            CASE
                WHEN s.component_tag ~ '^\d+-'
                    THEN (regexp_match(s.component_tag, '^(\d+)'))[1]
                WHEN ss.code ~ '^\d+$'
                    THEN ss.code
                ELSE NULL
            END,
            nullif(trim(both '_' from
                CASE
                    WHEN s.component_tag IS NULL OR s.component_tag = '' THEN NULL
                    WHEN s.component_tag ~ '^\d+-'
                        THEN regexp_replace(
                                regexp_replace(s.component_tag, '^\d+-', ''),
                                '[^a-zA-Z0-9]+', '_', 'g')
                    ELSE regexp_replace(s.component_tag, '[^a-zA-Z0-9]+', '_', 'g')
                END
            ), ''),
            nullif(_mias_fmt_text(s.description), '')
        ),
        '_+', '_', 'g'
    ))                                         AS new_tag
FROM signal s
LEFT JOIN signal_system ss ON s.system_id = ss.id
WHERE s.project_id = 1
ORDER BY ss.name, s.component_tag, s.id
LIMIT 50;

-- ============================================================
-- APPLY — uncomment to run
-- ============================================================

/*
DO $$
DECLARE
    rec    RECORD;
    v_sys  text;
    v_code text;
    v_suf  text;
    v_desc text;
    v_base text;
    v_tag  text;
    v_n    int;
BEGIN
    FOR rec IN
        SELECT
            s.id,
            s.description,
            s.component_tag,
            s.project_id,
            ss.code  AS sys_code,
            ss.name  AS sys_name
        FROM signal s
        LEFT JOIN signal_system ss ON s.system_id = ss.id
        WHERE s.project_id = 1
        ORDER BY ss.name, s.component_tag, s.id
    LOOP
        -- 1. System prefix: strip trailing "(NNN)" parenthetical, then format
        v_sys := _mias_fmt_text(
            regexp_replace(coalesce(rec.sys_name, ''), '\s*\([^)]*\)\s*$', '')
        );

        -- 2. Numeric code: from component_tag prefix, else system code
        IF rec.component_tag ~ '^\d+-' THEN
            v_code := (regexp_match(rec.component_tag, '^(\d+)'))[1];
        ELSIF rec.sys_code ~ '^\d+$' THEN
            v_code := rec.sys_code;
        ELSE
            v_code := NULL;
        END IF;

        -- 3. Component suffix
        IF rec.component_tag IS NULL OR rec.component_tag = '' THEN
            v_suf := NULL;
        ELSIF rec.component_tag ~ '^\d+-' THEN
            v_suf := trim(both '_' from
                regexp_replace(
                    regexp_replace(rec.component_tag, '^\d+-', ''),
                    '[^a-zA-Z0-9]+', '_', 'g'));
        ELSE
            -- e.g. "(N101)" → "N101"
            v_suf := trim(both '_' from
                regexp_replace(rec.component_tag, '[^a-zA-Z0-9]+', '_', 'g'));
        END IF;
        IF v_suf = '' THEN v_suf := NULL; END IF;

        -- 4. Description
        v_desc := _mias_fmt_text(rec.description);

        -- 5. Assemble
        v_base := trim(both '_' from
            regexp_replace(
                concat_ws('_',
                    nullif(v_sys, ''),
                    v_code,
                    v_suf,
                    nullif(v_desc, '')
                ),
                '_+', '_', 'g'));

        IF v_base IS NULL OR v_base = '' THEN
            v_base := 'Signal_' || rec.id;
        END IF;

        -- 6. Deduplicate within project
        v_tag := v_base;
        v_n   := 2;
        WHILE EXISTS (
            SELECT 1 FROM signal
            WHERE project_id = rec.project_id
              AND tag = v_tag
              AND id != rec.id
        ) LOOP
            v_tag := v_base || '_' || v_n;
            v_n   := v_n + 1;
        END LOOP;

        UPDATE signal SET tag = v_tag WHERE id = rec.id;
    END LOOP;
END;
$$;
*/

DROP FUNCTION IF EXISTS _mias_fmt_text(text);
DROP FUNCTION IF EXISTS _mias_fmt_word(text);

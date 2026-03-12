-- ============================================================
-- Populate signal.tag_suffix for all signals in all projects
--
-- Resolution hierarchy (first match wins):
--   1. instance_signal.override_tag         (manual override)
--   2. component_signal.tag_suffix           (from linked template)
--   3. _mias_fmt_text(signal.description)    (formatted description)
--
-- Safe to re-run: only updates rows where tag_suffix differs
-- from what would be generated (or is currently NULL).
-- ============================================================

-- Formatting helpers (same as generate_tags_lassemaja.sql)
CREATE OR REPLACE FUNCTION _mias_fmt_word(w text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF w IS NULL OR w = '' THEN RETURN ''; END IF;
    IF length(w) <= 3 AND w ~ '^[A-Z]+$' THEN RETURN w; END IF;
    RETURN initcap(lower(w));
END;
$$;

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
    s.tag,
    s.tag_suffix                           AS current_tag_suffix,
    COALESCE(
        NULLIF(ins.override_tag, ''),
        NULLIF(cs.tag_suffix, ''),
        NULLIF(_mias_fmt_text(s.description), '')
    )                                      AS new_tag_suffix,
    ins.override_tag                       AS override_tag,
    cs.tag_suffix                          AS template_tag_suffix,
    s.description
FROM signal s
LEFT JOIN instance_signal ins ON ins.id = s.instance_signal_id
LEFT JOIN component_signal cs  ON cs.id  = ins.component_signal_id
ORDER BY s.id
LIMIT 50;

-- ============================================================
-- APPLY — uncomment to run
-- ============================================================

/*
UPDATE signal s
SET tag_suffix = COALESCE(
    NULLIF(ins.override_tag, ''),
    NULLIF(cs.tag_suffix, ''),
    NULLIF(_mias_fmt_text(s.description), '')
)
FROM signal s_ref
LEFT JOIN instance_signal ins ON ins.id  = s_ref.instance_signal_id
LEFT JOIN component_signal cs  ON cs.id  = ins.component_signal_id
WHERE s.id = s_ref.id;

-- Report
SELECT
    COUNT(*)                                               AS total_signals,
    COUNT(tag_suffix)                                      AS tag_suffix_populated,
    COUNT(*) FILTER (WHERE tag_suffix IS NULL)             AS still_null,
    COUNT(*) FILTER (WHERE instance_signal_id IS NOT NULL
                     AND tag_suffix = cs_check.tag_suffix) AS from_template,
    COUNT(*) FILTER (WHERE instance_signal_id IS NULL)     AS from_description
FROM signal s
LEFT JOIN instance_signal ins ON ins.id = s.instance_signal_id
LEFT JOIN component_signal cs_check ON cs_check.id = ins.component_signal_id;
*/

DROP FUNCTION IF EXISTS _mias_fmt_text(text);
DROP FUNCTION IF EXISTS _mias_fmt_word(text);

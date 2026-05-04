-- FR-014 follow-up: widen codesys_data_type_value.value to BIGINT.
--
-- CODESYS DWORD-backed enums use the full unsigned 32-bit range
-- (0..4294967295). The first push the plugin tried (E_DataQuality)
-- includes BAD = 16#80000000 = 2147483648 — exceeds signed INT (max
-- 2147483647). BIGINT covers the full DWORD range with headroom.
--
-- Table is currently empty, so this is a non-destructive type change.

ALTER TABLE codesys_data_type_value
  ALTER COLUMN value TYPE BIGINT;

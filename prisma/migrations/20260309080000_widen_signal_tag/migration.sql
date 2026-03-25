-- Widen signal.tag from varchar(50) to varchar(150)
-- Required for METS IO-list GVL variable names which average 65 chars and reach up to 115 chars
-- Example: "AC_Distribution_875_A03_Q5_Remote_control_grid_contactor_activated" (66 chars)

ALTER TABLE "signal" ALTER COLUMN "tag" TYPE VARCHAR(150);

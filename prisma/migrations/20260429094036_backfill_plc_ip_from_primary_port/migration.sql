-- Back-fill plc.ip_address from the lowest-numbered plc_port row that has an
-- IP. Earlier hardware setups configured per-port IPs (PlcPort.ipAddress)
-- without setting the legacy top-level Plc.ipAddress. DevTools reads the
-- top-level column, so the UI showed "No IP" / refused connections even when
-- the device had a perfectly good X1 IP. This is a one-time data back-fill;
-- new PLCs created via the UI continue to set both as needed.

UPDATE plc
SET ip_address = (
    SELECT ip_address
    FROM plc_port
    WHERE plc_port.plc_id = plc.id
      AND plc_port.ip_address IS NOT NULL
    ORDER BY port_number ASC
    LIMIT 1
)
WHERE ip_address IS NULL
  AND id IN (
    SELECT DISTINCT plc_id
    FROM plc_port
    WHERE ip_address IS NOT NULL
  );

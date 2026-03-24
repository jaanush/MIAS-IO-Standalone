-- Module Type Code lookup table
-- Maps IoCardType + single-char code to hardware identifier groups
-- Format: N{cabinet}:D{carrier}:{code}{instance} e.g. N3:D03:BM01

INSERT INTO module_type_code (card_type, code, group_name, description) VALUES
  -- Distribution / Power Supply cards (A-D)
  ('SUPPLY', 'A', 'Distribution Card', 'Power supply (e.g. 750-613)'),
  ('SUPPLY', 'B', 'Distribution Card', 'Filter (e.g. 750-626)'),
  ('SUPPLY', 'C', 'Distribution Card', 'Pot. distribution (e.g. 750-1607)'),
  ('SUPPLY', 'D', 'Distribution Card', 'Spare distribution'),
  -- Communication / Serial cards (E-H)
  ('SERIAL', 'E', 'Com Card', 'Modbus (e.g. 750-652)'),
  ('SERIAL', 'F', 'Com Card', 'CANbus (e.g. 750-658)'),
  ('SERIAL', 'G', 'Com Card', 'Spare com'),
  ('SERIAL', 'H', 'Com Card', 'Spare com'),
  -- Digital Input cards (I-L)
  ('DI', 'I', 'DI Card', 'Primary DI (e.g. 750-1405 16-ch)'),
  ('DI', 'J', 'DI Card', 'Spare DI'),
  ('DI', 'K', 'DI Card', 'Spare DI'),
  ('DI', 'L', 'DI Card', 'Spare DI'),
  -- Digital Output cards (M-P)
  ('DO', 'M', 'DO Card', 'Primary DO (e.g. 750-1504 16-ch)'),
  ('DO', 'N', 'DO Card', 'Spare DO'),
  ('DO', 'O', 'DO Card', 'Spare DO'),
  ('DO', 'P', 'DO Card', 'Spare DO'),
  -- Analog Input cards (Q-T)
  ('AI', 'Q', 'AI Card', 'Voltage/current (e.g. 750-471)'),
  ('AI', 'R', 'AI Card', 'Spare AI'),
  ('AI', 'S', 'AI Card', 'Spare AI'),
  ('AI', 'T', 'AI Card', 'PT100/RTD (e.g. 750-461)'),
  -- Analog Output cards (U-X)
  ('AO', 'U', 'AO Card', '4-20mA output (e.g. 750-555)'),
  ('AO', 'V', 'AO Card', 'Spare AO'),
  ('AO', 'W', 'AO Card', 'Spare AO'),
  ('AO', 'X', 'AO Card', 'Spare AO')
ON CONFLICT (card_type, code) DO NOTHING;

-- Note: End-Module (y) and Spare (z) are special lowercase codes.
-- COUNTER, MIXED, RELAY, IO_LINK, PWM types need codes assigned later.

-- ============================================================
-- Seed: 20 placeholder employees
-- Run AFTER supabase_setup.sql
-- ============================================================

INSERT INTO employees (first_name, last_name, date_of_birth) VALUES
  ('Sebastian',      'Hunold',       '1985-09-05'),
  ('Klaus',     'Bergmann',    '1979-07-24'),
  ('Maria',     'Braun',       '1990-11-05'),
  ('Thomas',    'Decker',      '1983-01-30'),
  ('Sandra',    'Ehrhardt',    '1992-06-18'),
  ('Michael',   'Fischer',     '1976-09-02'),
  ('Julia',     'Grün',        '1988-04-15'),
  ('Andreas',   'Hartmann',    '1981-12-27'),
  ('Sabine',    'Hoffmann',    '1994-08-09'),
  ('Christian', 'Klein',       '1986-02-21'),
  ('Laura',     'Koch',        '1991-05-14'),
  ('Stefan',    'Krause',      '1978-10-03'),
  ('Nicole',    'Lange',       '1989-07-07'),
  ('Markus',    'Lehmann',     '1982-03-25'),
  ('Petra',     'Meyer',       '1975-11-19'),
  ('Daniel',    'Müller',      '1993-01-08'),
  ('Tanja',     'Neumann',     '1987-06-30'),
  ('Jörg',      'Schneider',   '1980-04-22'),
  ('Kerstin',   'Schulz',      '1995-09-16'),
  ('Rainer',    'Werner',      '1977-12-04')
ON CONFLICT (first_name, last_name, date_of_birth) DO NOTHING;

-- ============================================================
-- Dienstplanung – Supabase Setup SQL
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Create custom enum for availability status
CREATE TYPE availability_status AS ENUM (
  'available',
  'unavailable',
  'preferred_off'
);

-- 2. Employees table
CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate employees
CREATE UNIQUE INDEX IF NOT EXISTS employees_name_dob_idx
  ON employees (first_name, last_name, date_of_birth);

-- 3. Availability entries table
CREATE TABLE IF NOT EXISTS availability_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month         TEXT NOT NULL,          -- format: "2025-06"
  day           INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  status        availability_status NOT NULL,
  notes         TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by employee + month
CREATE INDEX IF NOT EXISTS entries_employee_month_idx
  ON availability_entries (employee_id, month);

-- Index for admin dashboard month queries
CREATE INDEX IF NOT EXISTS entries_month_idx
  ON availability_entries (month);

-- ============================================================
-- 4. Row Level Security (RLS)
-- Since there is no user auth, we allow public access.
-- The admin password check is handled client-side.
-- ============================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_entries ENABLE ROW LEVEL SECURITY;

-- Allow public read/write on employees
CREATE POLICY "Public read employees"
  ON employees FOR SELECT USING (true);

CREATE POLICY "Public insert employees"
  ON employees FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update employees"
  ON employees FOR UPDATE USING (true);

CREATE POLICY "Public delete employees"
  ON employees FOR DELETE USING (true);

-- Allow public read/write on availability_entries
CREATE POLICY "Public read entries"
  ON availability_entries FOR SELECT USING (true);

CREATE POLICY "Public insert entries"
  ON availability_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Public delete entries"
  ON availability_entries FOR DELETE USING (true);

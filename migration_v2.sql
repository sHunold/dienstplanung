-- ============================================================
-- Migration v2: Abgabefristen (month deadlines)
-- Run this in Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS month_deadlines (
  month       TEXT PRIMARY KEY,           -- "2026-06"
  deadline    DATE NOT NULL,              -- last editable date (inclusive)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE month_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deadlines"
  ON month_deadlines FOR SELECT USING (true);

CREATE POLICY "Public insert deadlines"
  ON month_deadlines FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update deadlines"
  ON month_deadlines FOR UPDATE USING (true);

CREATE POLICY "Public delete deadlines"
  ON month_deadlines FOR DELETE USING (true);

-- ============================================================
-- Migration v5: Neuer Status "Spätdienst"
-- Run this in Supabase → SQL Editor
-- ============================================================

ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'late_shift';

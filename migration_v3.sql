-- ============================================================
-- Migration v3: Erweiterte Status-Optionen
-- Run this in Supabase → SQL Editor
-- ============================================================

ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'part_time_off';   -- Teilzeitfrei
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'vacation';         -- Urlaub
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'training';         -- Fortbildung
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'overtime_off';     -- Freizeitausgleich
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'no_shift';         -- Kein Dienst
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'no_late_shift';    -- Kein Spätdienst
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'normal';           -- Normal / Egal
ALTER TYPE availability_status ADD VALUE IF NOT EXISTS 'preferred_shift';  -- Wunschdienst

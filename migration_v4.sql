-- ============================================================
-- Migration v4: Prio-Punkte für Wochenend-Tage
-- Run this in Supabase → SQL Editor
-- ============================================================

ALTER TABLE availability_entries
  ADD COLUMN IF NOT EXISTS priority_points SMALLINT NOT NULL DEFAULT 0
    CHECK (priority_points >= 0 AND priority_points <= 8);

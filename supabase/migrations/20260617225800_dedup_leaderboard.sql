-- ============================================================
-- Deduplicate leaderboard rows created by repeated seed runs.
-- Keeps the earliest inserted row per (name, difficulty, time_ms)
-- and deletes every later duplicate.
-- ============================================================

DELETE FROM leaderboard
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY name, difficulty, time_ms
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM leaderboard
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- Custom game scores: optional email + beaten-score notification tracking
-- Mirrors the main `leaderboard` table so a faster/higher custom-game
-- score can notify players it overtakes (one email per address, once).
-- Idempotent: safe to run on databases created before these columns existed.
-- ============================================================

-- Optional player email captured alongside a custom-game score.
alter table custom_game_scores add column if not exists email text;

-- Track whether a beaten-score notification email has been sent to this entry.
-- NULL = never notified (eligible); non-NULL = already notified once.
alter table custom_game_scores add column if not exists notified_at timestamptz;

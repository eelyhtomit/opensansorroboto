-- ============================================================
-- Shareable Custom Games with Per-Token Leaderboard
-- Players create a custom font-guessing game (font pool + count),
-- get a unique shareable token URL, and that URL carries its own
-- leaderboard ranked by score desc, then time asc.
-- ============================================================

-- 1. CUSTOM_GAMES TABLE — the settings behind a shareable token
create table if not exists custom_games (
  token         text primary key,
  fonts         jsonb not null,
  font_count    integer not null check (font_count between 2 and 4),
  creator_name  text,
  created_at    timestamptz default now()
);

-- 2. CUSTOM_GAME_SCORES TABLE — per-token leaderboard entries
create table if not exists custom_game_scores (
  id          uuid primary key default gen_random_uuid(),
  token       text not null references custom_games(token) on delete cascade,
  name        text not null,
  email       text,
  score       integer not null check (score between 0 and 10),
  time_ms     integer not null check (time_ms >= 0),
  created_at  timestamptz default now()
);

-- Add email column if the table already exists (idempotent migration)
alter table custom_game_scores add column if not exists email text;

-- Track whether a beaten-score notification email has been sent to this entry.
-- NULL = never notified (eligible); non-NULL = already notified once.
alter table custom_game_scores add column if not exists notified_at timestamptz;

-- Rank query support: score desc, time asc, scoped to a token.
create index if not exists custom_game_scores_token_rank_idx
  on custom_game_scores (token, score desc, time_ms asc);

-- 3. RLS POLICIES (mirror the permissive public leaderboard pattern;
--    inserts go through SvelteKit API routes using the anon key)

alter table custom_games enable row level security;

create policy "custom_games_select" on custom_games
  for select using (true);

create policy "custom_games_insert" on custom_games
  for insert with check (true);

alter table custom_game_scores enable row level security;

create policy "custom_game_scores_select" on custom_game_scores
  for select using (true);

create policy "custom_game_scores_insert" on custom_game_scores
  for insert with check (true);

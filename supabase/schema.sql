-- ============================================================
-- Font Guesser — Supabase Schema + Seed
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. PHRASES TABLE
create table if not exists phrases (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null default 'general',
  created_at timestamptz default now()
);

-- 2. LEADERBOARD TABLE
create table if not exists leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  time_ms integer not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'diabolical')),
  created_at timestamptz default now()
);

-- Add email column if table already exists (idempotent migration)
alter table leaderboard add column if not exists email text;

-- 3. RLS POLICIES

-- Phrases: public read-only
alter table phrases enable row level security;

create policy "phrases_select" on phrases
  for select using (true);

-- Leaderboard: public read + insert only (no update/delete)
alter table leaderboard enable row level security;

create policy "leaderboard_select" on leaderboard
  for select using (true);

create policy "leaderboard_insert" on leaderboard
  for insert with check (true);

-- ============================================================
-- SHAREABLE CUSTOM GAMES (per-token leaderboard)
-- ============================================================

-- custom_games: the settings behind a shareable token
create table if not exists custom_games (
  token         text primary key,
  fonts         jsonb not null,
  font_count    integer not null check (font_count between 2 and 4),
  creator_name  text,
  created_at    timestamptz default now()
);

-- custom_game_scores: per-token leaderboard entries
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

create index if not exists custom_game_scores_token_rank_idx
  on custom_game_scores (token, score desc, time_ms asc);

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

-- 4. SEED PHRASES
insert into phrases (text, category) values
  ('The quick brown fox jumps over the lazy dog', 'pangram'),
  ('Pack my box with five dozen liquor jugs', 'pangram'),
  ('How vexingly quick daft zebras jump', 'pangram'),
  ('The five boxing wizards jump quickly', 'pangram'),
  ('Sphinx of black quartz judge my vow', 'pangram'),
  ('Bright vixens jump dozy fowl quack', 'pangram'),
  ('Waltz nymph for quick jigs vex bud', 'pangram'),
  ('Glib jocks quiz nymph to vex dwarf', 'pangram'),
  ('Jackdaws love my big sphinx of quartz', 'pangram'),
  ('The jay pig fox zebra and my wolves quack', 'pangram'),
  ('Typography is the art of arranging type', 'design'),
  ('Good design is as little design as possible', 'design'),
  ('Form follows function in modern design', 'design'),
  ('Less is more', 'design'),
  ('Simplicity is the ultimate sophistication', 'design'),
  ('Design is not just what it looks like', 'design'),
  ('Every letter has a personality of its own', 'typography'),
  ('Clean lines define great sans-serif fonts', 'typography'),
  ('Readability is the foundation of good typography', 'typography'),
  ('A typeface tells a story without words', 'typography'),
  ('White space is not empty space', 'typography'),
  ('The best font is the one you barely notice', 'typography'),
  ('Kerning can make or break a design', 'typography'),
  ('Contrast creates visual hierarchy on the page', 'typography'),
  ('A well-chosen typeface elevates any message', 'typography'),
  ('Sans-serif fonts feel modern and clean', 'typography'),
  ('Helvetica and Arial are often confused', 'trivia'),
  ('Open Sans was designed for legibility on screens', 'trivia'),
  ('Roboto was created for the Android platform', 'trivia'),
  ('Inter was optimized for computer screens', 'trivia'),
  ('Lato means summer in Polish', 'trivia'),
  ('Montserrat is inspired by Buenos Aires signage', 'trivia'),
  ('Poppins is a geometric sans-serif from India', 'trivia'),
  ('Source Sans was Adobe''s first open source font', 'trivia'),
  ('Noto means no tofu in Unicode missing glyphs', 'trivia'),
  ('Variable fonts can adjust weight and width dynamically', 'trivia'),
  ('The default font size on most browsers is 16 pixels', 'trivia'),
  ('Line height affects readability more than font size', 'trivia'),
  ('Font weight ranges from 100 thin to 900 black', 'trivia'),
  ('OpenType features include ligatures and small caps', 'trivia'),
  ('Can you tell which font this text is rendered in', 'challenge'),
  ('Look closely at the letter forms before you answer', 'challenge'),
  ('Notice the curves and terminals of each character', 'challenge'),
  ('Study the spacing between letters carefully', 'challenge'),
  ('Each sans-serif has subtle differences in stroke width', 'challenge'),
  ('The lowercase g is a great font identifier', 'challenge'),
  ('Look at the lowercase a — is it single or double storey', 'challenge'),
  ('Check the capital R — does the leg kick out or sit straight', 'challenge'),
  ('The letter e reveals much about a typeface personality', 'challenge'),
  ('Notice how the dots above i and j are shaped', 'challenge');

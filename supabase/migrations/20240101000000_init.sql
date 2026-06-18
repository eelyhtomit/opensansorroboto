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
  time_ms integer not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'diabolical')),
  created_at timestamptz default now()
);

-- 3. RLS POLICIES

-- Phrases: public read-only
alter table phrases enable row level security;

do $$ begin
  create policy "phrases_select" on phrases for select using (true);
exception when duplicate_object then null;
end $$;

-- Leaderboard: public read + insert only (no update/delete)
alter table leaderboard enable row level security;

do $$ begin
  create policy "leaderboard_select" on leaderboard for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "leaderboard_insert" on leaderboard for insert with check (true);
exception when duplicate_object then null;
end $$;

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
  ('Notice how the dots above i and j are shaped', 'challenge')
on conflict do nothing;

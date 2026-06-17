-- ============================================================
-- Add game_plays table to track how many users actually play
-- ============================================================

create table if not exists game_plays (
  id         uuid        primary key default gen_random_uuid(),
  difficulty text        not null check (difficulty in ('easy', 'medium', 'hard', 'diabolical')),
  score      integer     not null default 0,
  time_ms    integer     not null default 0,
  completed  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- Public insert-only (no read needed from client)
alter table game_plays enable row level security;

create policy "game_plays_insert" on game_plays
  for insert with check (true);

-- Allow service-role reads for analytics (anon cannot read)
create policy "game_plays_select_service" on game_plays
  for select using (auth.role() = 'service_role');

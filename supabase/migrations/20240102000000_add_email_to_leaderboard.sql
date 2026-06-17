-- Add optional email column to leaderboard for beat-notifications
alter table leaderboard add column if not exists email text;

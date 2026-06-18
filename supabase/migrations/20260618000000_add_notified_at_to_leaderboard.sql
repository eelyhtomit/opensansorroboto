-- Track whether a beaten-score notification email has been sent to this entry.
-- NULL  = never notified (eligible to receive a notification)
-- non-NULL = already notified once (must not be emailed again)
alter table leaderboard add column if not exists notified_at timestamptz;

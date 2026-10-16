CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  player_name TEXT NOT NULL CHECK (length(trim(player_name)) > 0),
  games INTEGER NOT NULL CHECK (games BETWEEN 0 AND 100),
  time INTEGER NOT NULL CHECK (time >= 0),
  goals INTEGER NOT NULL CHECK (goals >= 0),
  xg DOUBLE PRECISION NOT NULL CHECK (xg >= 0),
  assists INTEGER NOT NULL CHECK (assists >= 0),
  xa DOUBLE PRECISION NOT NULL CHECK (xa >= 0),
  shots INTEGER NOT NULL CHECK (shots >= goals),
  key_passes INTEGER NOT NULL CHECK (key_passes >= 0),
  yellow_cards INTEGER NOT NULL CHECK (yellow_cards >= 0),
  red_cards INTEGER NOT NULL CHECK (red_cards >= 0),
  position TEXT NOT NULL,
  team_title TEXT NOT NULL CHECK (length(trim(team_title)) > 0),
  npg INTEGER NOT NULL CHECK (npg BETWEEN 0 AND goals),
  npxg DOUBLE PRECISION NOT NULL CHECK (npxg BETWEEN 0 AND xg + 0.000001),
  xgchain DOUBLE PRECISION NOT NULL CHECK (xgchain >= 0),
  xgbuildup DOUBLE PRECISION NOT NULL CHECK (xgbuildup >= 0)
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_title);
CREATE TABLE IF NOT EXISTS dataset_meta (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('original', 'demo')),
  row_count INTEGER NOT NULL CHECK (row_count > 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- S bukan posisi utama. Urutan prioritas mengikuti dokumen rancangan.
CREATE OR REPLACE VIEW player_metrics AS
SELECT *,
  CASE WHEN 'GK' = ANY(string_to_array(position, ' ')) THEN 'GK'
       WHEN 'F' = ANY(string_to_array(position, ' ')) THEN 'F'
       WHEN 'M' = ANY(string_to_array(position, ' ')) THEN 'M'
       WHEN 'D' = ANY(string_to_array(position, ' ')) THEN 'D'
       ELSE 'OTHER' END AS position_group,
  position ~ '(^| )S( |$)' AS appeared_as_substitute,
  strpos(team_title, ',') > 0 AS is_transfer,
  goals - npg AS penalty_goals,
  (xg - npxg) / 0.76 AS penalty_attempts_est,
  goals - xg AS finishing_delta,
  (goals + assists) * 90.0 / NULLIF(time, 0) AS ga_per90,
  yellow_cards * 90.0 / NULLIF(time, 0) AS yellow_per90
FROM players;

-- Statistik musiman pemain pindah klub tidak dapat diatribusikan ke satu klub.
CREATE OR REPLACE VIEW club_metrics AS
SELECT team_title, count(*)::integer AS player_count,
  sum(goals)::integer AS goals, sum(xg) AS xg,
  sum(assists)::integer AS assists, sum(time)::integer AS time,
  sum(yellow_cards)::integer AS yellow_cards,
  sum(red_cards)::integer AS red_cards,
  sum(goals - npg)::integer AS penalty_goals,
  sum((xg - npxg) / 0.76) AS penalty_attempts_est
FROM player_metrics WHERE NOT is_transfer GROUP BY team_title;

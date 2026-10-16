export const POSITION_LABELS = {
  GK: "Kiper",
  D: "Bek",
  M: "Gelandang",
  F: "Penyerang",
  OTHER: "Pengganti saja",
};
export const COMPARISON_METRICS = [
  ["npg", "Gol nonpenalti"],
  ["xg", "xG"],
  ["xa", "xA"],
  ["key_passes", "Umpan kunci"],
  ["shots", "Tembakan"],
  ["xgchain", "xGChain"],
];
export const sum = (rows, field) =>
  rows.reduce((total, p) => total + Number(p[field] || 0), 0);
export const per90 = (value, minutes) =>
  minutes > 0 ? (Number(value) * 90) / minutes : null;
export const ratio = (n, d) => (d > 0 ? n / d : null);
export const isTransfer = (p) => p.team_title.includes(",");
export function positionGroup(position) {
  const codes = position.split(/\s+/);
  return ["GK", "F", "M", "D"].find((c) => codes.includes(c)) || "OTHER";
}
export function enrich(p) {
  return {
    ...p,
    position_group: positionGroup(p.position),
    is_transfer: isTransfer(p),
    penalty_goals: p.goals - p.npg,
    penalty_attempts_est: (p.xg - p.npxg) / 0.76,
    finishing_delta: p.goals - p.xg,
    ga_per90: per90(p.goals + p.assists, p.time),
    yellow_per90: per90(p.yellow_cards, p.time),
  };
}
export function filterPlayers(
  rows,
  { team = "", position = "", minutes = 0 } = {},
) {
  return rows.filter(
    (p) =>
      (!team || p.team_title === team) &&
      (!position || positionGroup(p.position) === position) &&
      p.time >= minutes,
  );
}
export function rank(rows, value, limit = 10) {
  return [...rows]
    .sort((a, b) => value(b) - value(a) ||
      (typeof a.id === "number" ? a.id - b.id : String(a.id).localeCompare(String(b.id))))
    .slice(0, limit);
}
export function clubSummary(rows) {
  const groups = new Map();
  for (const p of rows.filter((p) => !isTransfer(p))) {
    if (!groups.has(p.team_title)) groups.set(p.team_title, []);
    groups.get(p.team_title).push(p);
  }
  return [...groups].map(([team_title, players]) => {
    const top = rank(players, (p) => p.goals, 1)[0];
    const values = Object.fromEntries(
      [
        "goals",
        "xg",
        "assists",
        "time",
        "yellow_cards",
        "red_cards",
        "penalty_goals",
        "penalty_attempts_est",
      ].map((k) => [k, sum(players, k)]),
    );
    return {
      id: team_title,
      team_title,
      player_count: players.length,
      core_count: players.filter((p) => p.time >= 2000).length,
      support_count: players.filter((p) => p.time < 2000).length,
      ...values,
      penalty_missed_est: Math.max(0, values.penalty_attempts_est - values.penalty_goals),
      finishing_delta: values.goals - values.xg,
      top,
      top_ties: players.filter((p) => p.goals === top.goals).length,
      top_share: ratio(top.goals, values.goals),
    };
  });
}
export function positionSummary(rows) {
  return ["GK", "D", "M", "F"]
    .map((code) => {
      const players = rows.filter((p) => positionGroup(p.position) === code);
      return {
        id: code,
        name: POSITION_LABELS[code],
        count: players.length,
        cards: sum(players, "yellow_cards"),
        minutes: sum(players, "time"),
        rate: per90(sum(players, "yellow_cards"), sum(players, "time")),
      };
    })
    .filter((p) => p.count && p.minutes > 0);
}
export function summary(rows) {
  const goals = sum(rows, "goals");
  const yellow = sum(rows, "yellow_cards");
  const xg = sum(rows, "xg");
  const attempts = sum(rows, "penalty_attempts_est");
  return {
    count: rows.length,
    goals,
    xg,
    yellow,
    red: sum(rows, "red_cards"),
    assists: sum(rows, "assists"),
    shots: sum(rows, "shots"),
    minutes: sum(rows, "time"),
    penaltyGoals: sum(rows, "penalty_goals"),
    penaltyAttempts: attempts,
    penaltyConversion: ratio(sum(rows, "penalty_goals"), attempts),
    lowMinutes: rows.filter((p) => p.time < 450).length,
    heavyMinutes: rows.filter((p) => p.time >= 3000).length,
    highCards: rows.filter((p) => p.yellow_cards >= 5).length,
    veryHighCards: rows.filter((p) => p.yellow_cards >= 10).length,
    transfers: rows.filter(isTransfer).length,
    clubs: new Set(rows.flatMap((p) => p.team_title.split(","))).size,
    substitute: rows.filter((p) => p.position.split(" ").includes("S")).length,
    noGoals: rows.filter((p) => p.goals === 0).length,
  };
}
/** Share of goals scored by the top approximately 5% of players. */
export function goalConcentration(rows) {
  const sorted = rank(rows, (p) => p.goals, rows.length);
  const total = sum(sorted, "goals");
  const topCount = rows.length
    ? Math.max(1, Math.floor(rows.length * 0.05))
    : 0;
  return {
    total,
    topCount,
    topShare: total ? sum(sorted.slice(0, topCount), "goals") / total : 0,
  };
}
/** Ordered, non-overlapping categories; final interval includes 3,420. */
export function minuteBands(rows) {
  return [0, 500, 1000, 1500, 2000, 2500, 3000].map((start) => {
    const end = Math.min(start + 500, 3420);
    return {
      id: start,
      start,
      end,
      name: `${start.toLocaleString("id-ID")}–${(end === 3420 ? end : end - 1).toLocaleString("id-ID")}`,
      count: rows.filter((p) => p.time >= start && (end === 3420 ? p.time <= end : p.time < end)).length,
    };
  });
}
/** Five positive and five negative deviations, without duplicate players. */
export function finishingExtremes(rows, limit = 5) {
  const best = rank(rows.filter((p) => p.finishing_delta > 0), (p) => p.finishing_delta, limit);
  const worst = rank(rows.filter((p) => p.finishing_delta < 0), (p) => -p.finishing_delta, limit);
  return rank([...best, ...worst], (p) => p.finishing_delta, limit * 2);
}
/** Average percentile rank for ties, computed against one fixed league cohort. */
export function percentile(value, values) {
  if (!values.length) return null;
  if (values.length === 1) return 50;
  const less = values.filter((v) => v < value - 1e-10).length;
  const equal = values.filter((v) => Math.abs(v - value) <= 1e-10).length;
  return (100 * (less + Math.max(0, equal - 1) / 2)) / (values.length - 1);
}
export function percentileProfiles(selected, leagueRows) {
  const cohort = leagueRows.filter((p) => p.time >= 900);
  return selected
    .filter((p) => cohort.some((c) => c.id === p.id))
    .map((p) => ({
      player: p,
      values: COMPARISON_METRICS.map(([key, label]) => ({
        key,
        label,
        raw: per90(p[key], p.time),
        percentile: percentile(
          per90(p[key], p.time),
          cohort.map((c) => per90(c[key], c.time)),
        ),
      })),
    }));
}
export function csvCell(value) {
  const string =
    typeof value === "string" && /^[=+\-@\t\r]/.test(value)
      ? `'${value}`
      : String(value ?? "");
  return `"${string.replaceAll('"', '""')}"`;
}

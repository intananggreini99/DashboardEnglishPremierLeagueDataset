import test from "node:test";
import assert from "node:assert/strict";
import {
  per90,
  positionGroup,
  enrich,
  filterPlayers,
  clubSummary,
  positionSummary,
  goalConcentration,
  minuteBands,
  finishingExtremes,
  percentile,
  percentileProfiles,
  csvCell,
} from "../frontend/js/analytics.js";
const player = (id, changes = {}) =>
  enrich({
    id,
    player_name: `Player ${id}`,
    team_title: "Club A",
    position: "M S",
    time: 900,
    games: 10,
    goals: 2,
    npg: 1,
    xg: 2.52,
    npxg: 1,
    assists: 1,
    xa: 1,
    shots: 8,
    key_passes: 10,
    yellow_cards: 2,
    red_cards: 0,
    xgchain: 4,
    xgbuildup: 2,
    ...changes,
  });
test("Position precedence, S-only classification, and zero-minute division", () => {
  assert.equal(positionGroup("D M F S"), "F");
  assert.equal(positionGroup("F GK S"), "GK");
  assert.equal(positionGroup("S"), "OTHER");
  assert.equal(per90(5, 0), null);
});
test("Club attribution excludes whole multi-club rows and position rates weight minutes", () => {
  const rows = [
    player(1),
    player(2, { time: 90, yellow_cards: 1 }),
    player(3, { team_title: "Club A,Club B", goals: 20, shots: 25 }),
  ];
  const clubs = clubSummary(rows);
  assert.equal(clubs.length, 1);
  assert.equal(clubs[0].goals, 4);
  assert.equal(clubs[0].player_count, 2);
  assert.equal(filterPlayers(rows, { team: "Club A" }).length, 2);
  assert.ok(Math.abs(positionSummary(rows)[0].rate - (5 * 90) / 1890) < 1e-8);
});
test("Goal concentration uses the top 5% and handles empty or goalless cohorts", () => {
  const p = goalConcentration([player(1, { goals: 0 }), player(2, { goals: 6 }), player(3, { goals: 2 })]);
  assert.equal(p.total, 8);
  assert.equal(p.topCount, 1);
  assert.equal(p.topShare, 0.75);
  assert.equal(goalConcentration([]).topShare, 0);
  assert.equal(goalConcentration([player(1, { goals: 0 })]).topShare, 0);
});
test("Minute intervals count every boundary once, including the final 3420", () => {
  const values = [0, 499, 500, 999, 1000, 1499, 1500, 1999, 2000, 2499, 2500, 2999, 3000, 3420];
  const bands = minuteBands(values.map((time, i) => player(i + 1, { time })));
  assert.deepEqual(bands.map((b) => b.count), [2, 2, 2, 2, 2, 2, 2]);
  assert.equal(bands.at(-1).end, 3420);
});
test("Rotation thresholds and penalties preserve their component totals", () => {
  const club = clubSummary([player(1, {time: 1999}), player(2, {time: 2000})])[0];
  assert.equal(club.core_count, 1);
  assert.equal(club.support_count, 1);
  assert.equal(club.core_count + club.support_count, club.player_count);
  assert.ok(Math.abs(club.penalty_goals + club.penalty_missed_est - club.penalty_attempts_est) < 1e-10);
});
test("Finishing extremes select five of each sign, handle small sets, and never duplicate", () => {
  const rows = Array.from({ length: 15 }, (_, i) => player(i + 1, { goals: i, xg: 7 }));
  const extremes = finishingExtremes(rows);
  assert.equal(extremes.length, 10);
  assert.equal(new Set(extremes.map((p) => p.id)).size, 10);
  assert.deepEqual(extremes.map((p) => p.finishing_delta), [7, 6, 5, 4, 3, -3, -4, -5, -6, -7]);
  assert.equal(finishingExtremes([rows[0], rows[14]]).length, 2);
  assert.equal(finishingExtremes([rows[7]]).length, 0);
});
test("Heatmap uses per90 and tied percentile ranks on a fixed eligible league cohort", () => {
  assert.equal(percentile(1, [0, 1, 1, 2]), 50);
  assert.equal(percentile(0, [0, 0]), 50);
  assert.equal(percentile(2, [0, 1, 2]), 100);
  const rows = [
    player(1, { goals: 4, npg: 4 }),
    player(2, { goals: 2, npg: 2 }),
    player(3, { time: 1800, goals: 4, npg: 4 }),
    player(4, { time: 90, goals: 30, npg: 30 }),
  ];
  const profile = percentileProfiles([rows[1]], rows);
  assert.equal(profile[0].values[0].raw, 0.2);
  assert.equal(profile[0].values[0].percentile, 25);
  assert.equal(percentileProfiles([rows[3]], rows).length, 0);
});
test("CSV exports escape quote delimiters and neutralize spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell("A,B"), '"A,B"');
  assert.equal(csvCell(-1.5), '"-1.5"');
});

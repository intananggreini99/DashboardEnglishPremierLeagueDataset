import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as d3 from "d3";
import { parseDataset } from "../server/importer.js";
import { enrich, summary, clubSummary, minuteBands, goalConcentration, finishingExtremes, percentileProfiles } from "../frontend/js/analytics.js";
const raw = parseDataset(await readFile(new URL("../data/epl-goalScorer(20-21)(in).csv", import.meta.url)));
const rows = raw.map(enrich);

test("The supplied 522-player snapshot reproduces the guide's reference figures", () => {
  const s = summary(rows), concentration = goalConcentration(rows);
  assert.equal(s.count, 522);
  assert.equal(s.highCards, 70);
  assert.equal(s.veryHighCards, 4);
  assert.equal(s.heavyMinutes, 41);
  assert.equal(s.noGoals, 255);
  assert.equal(s.goals, 972);
  assert.equal(concentration.topCount, 26);
  assert.equal(Math.round(concentration.topShare * 100), 35);
  assert.deepEqual(minuteBands(rows).map((b) => b.count), [133, 74, 80, 62, 69, 63, 41]);
  const clubs = clubSummary(rows);
  assert.equal(clubs.length, 20);
  assert.ok(clubs.every((c) => c.core_count + c.support_count === c.player_count));
  assert.ok(Math.abs(clubs.find((c) => c.team_title === "Tottenham").finishing_delta - 8.158588026) < 1e-7);
  assert.ok(Math.abs(clubs.find((c) => c.team_title === "Brighton").finishing_delta + 15.316332051) < 1e-7);
  const extremes = finishingExtremes(rows);
  assert.equal(extremes.length, 10);
  assert.equal(extremes[0].player_name, "Son Heung-Min");
  assert.equal(extremes.at(-1).player_name, "Timo Werner");
});

for (const role of ["penyelenggara", "penonton"]) {
  test(`${role}: snapshot renders all recommended chart types and accurate segment values`, async () => {
    const dom = new JSDOM(await readFile(new URL(`../frontend/${role}.html`, import.meta.url), "utf8"), { url: `http://localhost/${role}.html` });
    for (const key of ["document", "window", "location", "history"]) globalThis[key] = dom.window[key];
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.d3 = d3;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ meta: { mode: "original", filename: "epl-goalScorer(20-21)(in).csv" }, players: raw }) });
    await import(`../frontend/js/app.js?snapshot=${role}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll(".chart-card").length, 8);
    assert.equal(doc.querySelectorAll(".role-badge, .scope-line, .metric p, .chart-tag, .chart-subtitle, .snapshot-note, .card-notes, #methodology").length, 0);
    assert.equal(doc.querySelector("#demo-banner").hidden, true);
    assert.equal(doc.querySelector(".error-state"), null);
    if (role === "penyelenggara") {
      assert.equal(doc.querySelectorAll("#club-cards .bar-primary").length, 20);
      assert.equal(doc.querySelectorAll("#club-cards .annotation").length, 20);
      assert.equal(doc.querySelectorAll("#position-cards .bar-vertical").length, 4);
      assert.equal(doc.querySelectorAll("#card-thresholds .discipline-table tbody tr").length, 5);
      assert.deepEqual([...doc.querySelectorAll("#card-thresholds .simple-stat strong")].map((e) => e.textContent), ["70", "4"]);
      assert.equal(doc.querySelectorAll("#penalty-clubs .bar-secondary").length, 20);
      assert.equal(doc.querySelectorAll("#rotation .bar-secondary").length, 20);
      assert.equal(doc.querySelectorAll("#minute-bands .bar-vertical").length, 7);
      assert.equal(doc.querySelectorAll("#club-quality .delta-bar").length, 20);
      assert.equal([...doc.querySelectorAll("#club-quality .value-label")].filter((e) => e.textContent).length, 2);
      const cells = [...doc.querySelectorAll("#goal-concentration .waffle-cell")];
      assert.equal(cells.length, 100);
      assert.equal(cells.filter((e) => e.getAttribute("fill") === "#49c980").length, 35);
    } else {
      const kaneGoal = doc.querySelector("#top-scorers .bar-primary"), kanePenalty = doc.querySelector("#top-scorers .bar-secondary");
      assert.match(kaneGoal.getAttribute("aria-label"), /Nonpenalti: 19 · Penalti: 4/);
      assert.ok(Math.abs(+kaneGoal.getAttribute("width") / +kanePenalty.getAttribute("width") - 19 / 4) < 1e-10);
      assert.equal(doc.querySelectorAll("#finishing .delta-bar").length, 10);
      assert.equal(doc.querySelectorAll("#creators .annotation").length, 10);
      assert.match(doc.querySelector("#creators .chart-context").textContent, /Rodri/);
      assert.equal(doc.querySelector("#efficiency-insight").textContent, "Top 10 Gol + Assist per 90 Menit");
      assert.match(doc.querySelector("#efficiency .bar-primary").getAttribute("aria-label"), /Gareth Bale[\s\S]*1,29/);
      const tops = [...doc.querySelectorAll("#club-heroes .share-top")], rests = [...doc.querySelectorAll("#club-heroes .share-rest")];
      assert.equal(tops.length, 20);
      assert.ok(tops.every((e, i) => Math.abs(+e.getAttribute("width") + +rests[i].getAttribute("width") - 425) < 1e-7));
      assert.equal(doc.querySelectorAll("#player-heatmap .heat-cell").length, 18);
      const profiles = percentileProfiles(["Harry Kane", "Mohamed Salah", "Bruno Fernandes"].map((name) => rows.find((p) => p.player_name === name)), rows);
      assert.deepEqual([...doc.querySelectorAll("#player-heatmap .heat-value")].map((e) => e.textContent), profiles.flatMap((p) => p.values.map((v) => Math.round(v.percentile).toString())));
      assert.match(doc.querySelector("#season-facts").textContent, /Alisson \(Liverpool\)/);
    }
    dom.window.close();
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as d3 from "d3";
import { parseDataset } from "../server/importer.js";

const players = parseDataset(
  await readFile(new URL("../data/demo-synthetic.csv", import.meta.url)),
);
function globals(dom) {
  for (const key of [
    "document",
    "window",
    "location",
    "history",
    "getComputedStyle",
  ])
    globalThis[key] =
      key === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[key];
  globalThis.d3 = d3;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      meta: {
        mode: "demo",
        filename: "demo-synthetic.csv",
        row_count: players.length,
      },
      players,
    }),
  });
}
function finiteCharts(document) {
  for (const node of document.querySelectorAll("svg *"))
    for (const attr of [
      "d",
      "x",
      "y",
      "cx",
      "cy",
      "x1",
      "x2",
      "y1",
      "y2",
      "width",
      "height",
      "r",
      "transform",
    ]) {
      const value = node.getAttribute(attr);
      if (value)
        assert.ok(
          !/NaN|Infinity|undefined/.test(value),
          `${node.tagName} ${attr}=${value}`,
        );
    }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 40));

for (const role of ["penyelenggara", "penonton"])
  test(`${role}: charts, single-chart navigation, mobile menu, filters, table and comparison work`, async () => {
    const html = await readFile(
      new URL(`../frontend/${role}.html`, import.meta.url),
      "utf8",
    );
    const dom = new JSDOM(html, { url: `http://localhost/${role}.html` });
    globals(dom);
    await import(`../frontend/js/app.js?test=${role}`);
    await tick();
    const doc = dom.window.document;
    assert.equal(doc.querySelector("#demo-banner").hidden, false);
    assert.equal(doc.querySelectorAll(".chart").length, 8);
    assert.equal(
      doc.querySelectorAll(".chart svg").length,
      7,
    );
    assert.equal(
      doc.querySelector("#content").getAttribute("aria-busy"),
      "false",
    );
    assert.ok(doc.querySelector("#filter-count").textContent.includes("124"));
    finiteCharts(doc);
    assert.equal(doc.querySelector("#players").hidden, true);
    const chartLinks = [...doc.querySelectorAll(".nav-link")].slice(1, -1);
    assert.equal(chartLinks.length, 8);
    for (const link of chartLinks) {
      link.click();
      const visible = [...doc.querySelectorAll(".chart-card")].filter((card) => !card.hidden);
      assert.equal(visible.length, 1);
      assert.equal(visible[0].dataset.chart, link.dataset.view);
      assert.equal(doc.querySelector(".metric-grid").hidden, true);
      assert.equal(doc.querySelector("#players").hidden, true);
      assert.equal(link.getAttribute("aria-current"), "page");
      assert.equal(dom.window.location.hash, `#${link.dataset.view}`);
    }
    doc.querySelector("#menu-toggle").click();
    assert.equal(doc.querySelector("#menu-toggle").getAttribute("aria-expanded"), "true");
    chartLinks[0].click();
    assert.equal(doc.querySelector("#menu-toggle").getAttribute("aria-expanded"), "false");
    const team = doc.querySelector("#team-filter");
    team.value = "Klub Demo 01";
    team.dispatchEvent(new dom.window.Event("change"));
    assert.ok(doc.querySelector("#filter-count").textContent.startsWith("6 /"));
    assert.equal(doc.querySelectorAll("#player-rows tr").length, 6);
    assert.equal(doc.querySelectorAll(".chart-card:not([hidden])").length, 1);
    assert.equal(doc.querySelector(".chart-card:not([hidden])").dataset.chart, chartLinks[0].dataset.view);
    doc.querySelector('[data-view="players"]').click();
    assert.equal(doc.querySelector("#players").hidden, false);
    assert.equal(doc.querySelector(".dashboard-grid").hidden, true);
    assert.equal(doc.querySelector("#team-filter").value, "Klub Demo 01");
    finiteCharts(doc);
    const search = doc.querySelector("#player-search");
    search.value = "NO-MATCH-ANYWHERE";
    search.dispatchEvent(new dom.window.Event("input"));
    assert.ok(
      doc
        .querySelector("#player-rows")
        .textContent.includes("Tidak ada pemain"),
    );
    assert.ok(doc.querySelector("#filter-count").textContent.startsWith("6 /"));
    doc.querySelector("#reset").click();
    const button = doc.querySelector('[data-sort="player_name"]');
    button.click();
    assert.equal(button.parentElement.getAttribute("aria-sort"), "ascending");
    doc.querySelector("#next-page").click();
    assert.ok(doc.querySelector("#page-label").textContent.startsWith("2 /"));
    // No S-only players reach 3000 minutes: all charts must show empty states without nonfinite SVG.
    const pos = doc.querySelector("#position-filter");
    pos.value = "OTHER";
    pos.dispatchEvent(new dom.window.Event("change"));
    const mins = doc.querySelector("#minutes-filter");
    mins.value = "3000";
    mins.dispatchEvent(new dom.window.Event("change"));
    assert.ok(doc.querySelector("#filter-count").textContent.startsWith("0 /"));
    assert.ok(doc.querySelectorAll(".chart-empty").length >= 7);
    finiteCharts(doc);
    doc.querySelector("#reset").click();
    assert.ok(
      doc.querySelector("#filter-count").textContent.startsWith("124 /"),
    );
    assert.equal(doc.querySelector("#players").hidden, false);
    doc.querySelector('[data-view="overview"]').click();
    assert.equal(doc.querySelectorAll(".chart-card:not([hidden])").length, 8);
    assert.equal(doc.querySelector(".metric-grid").hidden, false);
    assert.equal(doc.querySelector("#players").hidden, true);
    if (role === "penonton") {
      const eff = doc.querySelector("#efficiency-min");
      eff.value = "2700";
      eff.dispatchEvent(new dom.window.Event("change"));
      assert.ok(
        doc.querySelector("#efficiency-insight").textContent.includes("Gol + Assist per 90 Menit"),
      );
      const select = doc.querySelector("#compare-0");
      select.value = "";
      select.dispatchEvent(new dom.window.Event("change"));
      finiteCharts(doc);
    }
    dom.window.close();
  });

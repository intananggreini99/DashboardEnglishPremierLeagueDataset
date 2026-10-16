/* D3 charts follow the supplied presentation guide; every value comes from data. */
import { rank, summary, goalConcentration, minuteBands, percentileProfiles } from "./analytics.js";
const d3 = globalThis.d3;
const W = 680;
export const COLORS = { neutral: "#8c9691", secondary: "#414c46", accent: "#49c980", ink: "#e9f1ec", muted: "#a8baae" };
const number = (n, digits = 0) => n == null ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);
const signed = (n) => `${n > 0 ? "+" : ""}${number(n, 1)}`;
const percent = (n, digits = 1) => `${number(n * 100, digits)}%`;
const short = (s, n = 29) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

export function clearTooltip() { const t = document.getElementById("tooltip"); if (t) t.hidden = true; }
function tooltip(event, text, node) {
  const t = document.getElementById("tooltip");
  if (!t) return;
  t.textContent = text; t.hidden = false;
  const rect = node.getBoundingClientRect();
  const x = event.type !== "focus" && Number.isFinite(event.clientX) ? event.clientX : rect.x + rect.width / 2;
  const y = event.type !== "focus" && Number.isFinite(event.clientY) ? event.clientY : rect.y + rect.height / 2;
  t.style.left = `${Math.max(8, Math.min(x + 13, window.innerWidth - t.offsetWidth - 12))}px`;
  t.style.top = `${Math.max(8, Math.min(y + 13, window.innerHeight - t.offsetHeight - 12))}px`;
}
function interactive(selection, label, click) {
  selection.classed("mark", true).attr("tabindex", 0).attr("role", click ? "button" : "graphics-symbol")
    .attr("aria-label", label)
    .on("pointerenter pointermove focus", function (e, d) { tooltip(e, label(d), this); })
    .on("pointerleave blur", clearTooltip)
    .on("keydown", function (e, d) {
      if (e.key === "Escape") clearTooltip();
      if (click && ["Enter", " "].includes(e.key)) { e.preventDefault(); clearTooltip(); click(d); }
    });
  if (click) selection.style("cursor", "pointer").on("click", (_e, d) => { clearTooltip(); click(d); });
  return selection;
}
function empty(container, message = "Tidak ada pemain yang memenuhi filter ini.") {
  container.replaceChildren();
  const div = document.createElement("div"); div.className = "chart-empty"; div.textContent = message; container.append(div);
}
function canvas(container, { height = 320, title = "", description = "", margin = {} } = {}) {
  container.replaceChildren();
  const m = { top: 24, right: 48, bottom: 46, left: 54, ...margin };
  const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${W} ${height}`).attr("role", "img").attr("aria-label", title);
  svg.append("title").text(title); svg.append("desc").text(description);
  return { svg, m, width: W - m.left - m.right, height: height - m.top - m.bottom,
    g: svg.append("g").attr("transform", `translate(${m.left},${m.top})`) };
}
function gridX(c, x, formatter = (v) => number(v, 1), ticks = 5) {
  c.g.append("g").attr("class", "grid").attr("transform", `translate(0,${c.height})`)
    .call(d3.axisBottom(x).ticks(ticks).tickSize(-c.height).tickFormat(""));
  c.g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${c.height})`)
    .call(d3.axisBottom(x).ticks(ticks).tickSize(0).tickPadding(10).tickFormat(formatter));
}
function axisLabel(c, text) {
  c.g.append("text").attr("class", "axis-label").attr("x", c.width / 2).attr("y", c.height + 42).attr("text-anchor", "middle").text(text);
}
function rowNames(c, rows, y, name) {
  c.g.selectAll(".row-label").data(rows).join("text").attr("class", "row-label")
    .attr("x", -12).attr("y", (_, i) => y(i) + y.bandwidth() / 2 + 4).attr("text-anchor", "end")
    .text((p) => short(name(p))).append("title").text(name);
}

/** Zero-based ranked horizontal bars; optional second segment and aligned numeric column. */
export function bars(container, rows, { key = "goals", name = (p) => p.player_name, secondary = null,
  digits = 0, title = "", onClick, label, annotation = null, highlight = (_p, i) => i === 0, xLabel = "" } = {}) {
  if (!rows.length) return empty(container);
  const total = (p) => p[key] + (secondary ? p[secondary] : 0);
  const c = canvas(container, { height: Math.max(230, rows.length * 34 + 82), title,
    margin: { left: 190, right: annotation ? 124 : 68, top: 24, bottom: 54 } });
  const x = d3.scaleLinear().domain([0, d3.max(rows, total) || 1]).nice().range([0, c.width]);
  const y = d3.scaleBand().domain(rows.map((_, i) => i)).range([0, c.height]).padding(0.38);
  gridX(c, x, (v) => number(v, digits), digits === 0 ? Math.min(5, x.domain()[1]) : 5); rowNames(c, rows, y, name); axisLabel(c, xLabel);
  const tip = label || ((p) => `${name(p)}\n${number(p[key], digits)}${secondary ? ` + ${number(p[secondary], digits)} = ${number(total(p), digits)}` : ""}`);
  const primary = c.g.selectAll(".bar-primary").data(rows).join("rect").attr("class", "bar-primary")
    .attr("x", 0).attr("y", (_p, i) => y(i)).attr("width", (p) => Math.max(0, x(p[key])))
    .attr("height", y.bandwidth()).attr("fill", (p, i) => highlight(p, i) ? COLORS.accent : COLORS.neutral);
  interactive(primary, tip, onClick);
  if (secondary) {
    const second = c.g.selectAll(".bar-secondary").data(rows).join("rect").attr("class", "bar-secondary")
      .attr("x", (p) => x(p[key])).attr("y", (_p, i) => y(i)).attr("width", (p) => Math.max(0, x(p[secondary])))
      .attr("height", y.bandwidth()).attr("fill", COLORS.secondary);
    interactive(second, tip, onClick);
  }
  c.g.selectAll(".value-label").data(rows).join("text").attr("class", "value-label")
    .attr("x", (p) => x(total(p)) + 7).attr("y", (_p, i) => y(i) + y.bandwidth() / 2 + 4).text((p) => number(total(p), digits));
  if (annotation) {
    c.g.append("text").attr("class", "column-heading").attr("x", c.width + 104).attr("y", -10).attr("text-anchor", "end").text(annotation.title);
    c.g.selectAll(".annotation").data(rows).join("text").attr("class", "annotation value-label")
      .attr("x", c.width + 104).attr("y", (_p, i) => y(i) + y.bandwidth() / 2 + 4).attr("text-anchor", "end").text(annotation.value);
  }
}

export function verticalBars(container, rows, { key = "rate", title = "", label, highlight = () => false,
  digits = 2, xLabel = "", yLabel = "" } = {}) {
  if (!rows.length) return empty(container);
  const c = canvas(container, { title, height: 340, margin: { top: 35, right: 25, bottom: 60 } });
  const x = d3.scaleBand().domain(rows.map((p) => p.name)).range([0, c.width]).padding(0.25);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (p) => p[key]) || 1]).nice().range([c.height, 0]);
  c.g.append("g").attr("class", "y-axis").call(d3.axisLeft(y).ticks(digits === 0 ? Math.min(5, y.domain()[1]) : 5).tickSize(-c.width).tickPadding(8).tickFormat((v) => number(v, digits)));
  c.g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${c.height})`).call(d3.axisBottom(x).tickSize(0).tickPadding(12));
  c.g.append("text").attr("class", "axis-label").attr("x", 0).attr("y", -18).text(yLabel); axisLabel(c, xLabel);
  const marks = c.g.selectAll(".bar-vertical").data(rows).join("rect").attr("class", "bar-vertical")
    .attr("x", (p) => x(p.name)).attr("y", (p) => y(p[key])).attr("width", x.bandwidth())
    .attr("height", (p) => c.height - y(p[key])).attr("fill", (p) => highlight(p) ? COLORS.accent : COLORS.neutral);
  interactive(marks, label || ((p) => `${p.name}: ${number(p[key], digits)}`));
  c.g.selectAll(".value-label").data(rows).join("text").attr("class", "value-label").attr("x", (p) => x(p.name) + x.bandwidth() / 2)
    .attr("y", (p) => y(p[key]) - 8).attr("text-anchor", "middle").text((p) => number(p[key], digits));
}
export function minutes(container, rows, options = {}) {
  if (!rows.length) return empty(container);
  verticalBars(container, minuteBands(rows), { ...options, key: "count", digits: 0, xLabel: "Menit bermain dalam snapshot", yLabel: "Jumlah pemain",
    highlight: (p) => p.start === 3000, label: (p) => `${p.name} menit: ${p.count} pemain` });
  const beyond = rows.filter((p) => p.time > 3420).length;
  if (beyond) appendNote(container, `${beyond} pemain melebihi 3.420 menit dan tidak masuk rentang musim 38 laga ini.`);
}

/** Signed bars use a symmetric domain so zero stays in the middle. */
export function diverging(container, rows, { title = "", name = (p) => p.player_name, onClick, endpointsOnly = false } = {}) {
  if (!rows.length) return empty(container, "Tidak ada selisih gol terhadap xG dalam cakupan ini.");
  const c = canvas(container, { title, height: Math.max(230, rows.length * 34 + 82), margin: { left: 230, right: 64, bottom: 54 } });
  const max = d3.max(rows, (p) => Math.abs(p.finishing_delta)) || 1;
  const x = d3.scaleLinear().domain([-max, max]).nice().range([0, c.width]);
  const y = d3.scaleBand().domain(rows.map((_, i) => i)).range([0, c.height]).padding(0.38);
  gridX(c, x, signed); rowNames(c, rows, y, name); c.g.selectAll(".row-label").attr("x", -52); axisLabel(c, "Gol − xG  ·  kurang ← 0 → lebih");
  c.g.append("line").attr("class", "zero-line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", -8).attr("y2", c.height);
  const marks = c.g.selectAll(".delta-bar").data(rows).join("rect").attr("class", "delta-bar")
    .attr("x", (p) => x(Math.min(0, p.finishing_delta))).attr("y", (_p, i) => y(i))
    .attr("width", (p) => Math.abs(x(p.finishing_delta) - x(0))).attr("height", y.bandwidth())
    .attr("fill", (_p, i) => i === 0 || i === rows.length - 1 ? COLORS.accent : COLORS.neutral);
  interactive(marks, (p) => `${name(p)}\nGol: ${p.goals} · xG: ${number(p.xg, 2)}\nGol − xG: ${signed(p.finishing_delta)}`, onClick);
  c.g.selectAll(".value-label").data(rows).join("text").attr("class", "value-label")
    .attr("x", (p) => x(p.finishing_delta) + (p.finishing_delta >= 0 ? 7 : -7))
    .attr("y", (_p, i) => y(i) + y.bandwidth() / 2 + 4).attr("text-anchor", (p) => p.finishing_delta >= 0 ? "start" : "end")
    .text((p, i) => !endpointsOnly || i === 0 || i === rows.length - 1 ? signed(p.finishing_delta) : "");
}
function appendNote(container, text) { const note = document.createElement("p"); note.className = "chart-context"; note.textContent = text; container.append(note); }
function statBlock(parent, value, label) {
  const block = document.createElement("div"); block.className = "simple-stat";
  const strong = document.createElement("strong"); strong.textContent = value;
  const span = document.createElement("span"); span.textContent = label;
  block.append(strong, span); parent.append(block);
}
export function discipline(container, rows) {
  if (!rows.length) return empty(container);
  container.replaceChildren();
  const s = summary(rows), stats = document.createElement("div"); stats.className = "simple-stats";
  statBlock(stats, number(s.highCards), "pemain menerima ≥5 kartu kuning");
  statBlock(stats, number(s.veryHighCards), "di antaranya menerima ≥10 kartu kuning"); container.append(stats);
  const wrap = document.createElement("div"); wrap.className = "data-table-wrap";
  const table = document.createElement("table"); table.className = "data-table discipline-table";
  const caption = table.createCaption(); caption.textContent = `Top ${Math.min(5, rows.length)} Pemain dengan Kartu Kuning Terbanyak`;
  const head = table.createTHead().insertRow();
  for (const label of ["Pemain", "Klub", "Kuning", "Merah"]) { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); }
  const body = table.createTBody();
  for (const p of rank(rows, (p) => p.yellow_cards, 5)) {
    const row = body.insertRow();
    for (const v of [p.player_name, p.team_title.replaceAll(",", " / "), p.yellow_cards, p.red_cards]) row.insertCell().textContent = v;
  }
  wrap.append(table); container.append(wrap);
}
export function waffle(container, rows, { title = "" } = {}) {
  if (!rows.length) return empty(container);
  const p = goalConcentration(rows), s = summary(rows);
  if (!p.total) return empty(container, "Tidak ada gol dalam cakupan ini; proporsi gol tidak dapat dihitung.");
  const c = canvas(container, { title, height: 286, margin: { top: 8, right: 8, bottom: 8, left: 8 } });
  const filled = Math.round(p.topShare * 100);
  c.svg.attr("aria-label", `${title}. ${filled} dari 100 kotak mewakili ${percent(p.topShare)} gol.`);
  c.g.selectAll(".waffle-cell").data(d3.range(100)).join("rect").attr("class", "waffle-cell")
    .attr("x", (i) => i % 10 * 25).attr("y", (i) => Math.floor(i / 10) * 25).attr("width", 21).attr("height", 21).attr("rx", 2)
    .attr("fill", (i) => i < filled ? COLORS.accent : COLORS.secondary);
  c.g.append("text").attr("class", "waffle-number").attr("x", 290).attr("y", 65).text(percent(p.topShare, 0));
  c.g.append("text").attr("class", "waffle-caption").attr("x", 290).attr("y", 94).text(`gol dicetak ${p.topCount} pemain teratas (${percent(p.topCount / rows.length)})`);
  c.g.append("text").attr("class", "waffle-number").attr("x", 290).attr("y", 165).text(percent(s.noGoals / s.count, 0));
  c.g.append("text").attr("class", "waffle-caption").attr("x", 290).attr("y", 194).text(`${s.noGoals} dari ${s.count} pemain tidak mencetak gol`);
  c.g.append("text").attr("class", "axis-label").attr("x", 0).attr("y", 267).text("100 kotak = seluruh gol · 1 kotak ≈ 1%");
}
export function creators(container, rows, options) {
  bars(container, rank(rows, (p) => p.key_passes, 10), { ...options, key: "key_passes", xLabel: "Umpan kunci",
    annotation: { title: "xA", value: (p) => number(p.xa, 2) },
    label: (p) => `${p.player_name}\nUmpan kunci: ${p.key_passes}\nxA: ${number(p.xa, 2)}\nxGBuildup: ${number(p.xgbuildup, 2)}` });
  if (rows.length) appendNote(container, `Tiga xGBuildup tertinggi (total musim): ${rank(rows, (p) => p.xgbuildup, 3).map((p) => `${p.player_name} (${number(p.xgbuildup, 2)})`).join(" · ")}.`);
}
export function clubShares(container, clubs, { title = "", onClick } = {}) {
  const rows = rank(clubs.filter((p) => p.top_share != null), (p) => p.top_share, clubs.length);
  if (!rows.length) return empty(container, "Tidak ada gol klub untuk menghitung komposisi.");
  const c = canvas(container, { title, height: rows.length * 43 + 82, margin: { left: 190, right: 65, bottom: 54 } });
  const x = d3.scaleLinear().domain([0, 1]).range([0, c.width]);
  const y = d3.scaleBand().domain(rows.map((_, i) => i)).range([0, c.height]).padding(0.22);
  gridX(c, x, (v) => percent(v, 0)); rowNames(c, rows, y, (p) => p.team_title); axisLabel(c, "Porsi gol pemain satu klub");
  const tip = (p) => `${p.team_title}\n${p.top.player_name}: ${p.top.goals} dari ${p.goals} gol (${percent(p.top_share)})\nPemain lain: ${p.goals - p.top.goals} gol${p.top_ties > 1 ? `\n${p.top_ties} pemain seri; ditampilkan satu berdasarkan ID.` : ""}`;
  const base = c.g.selectAll(".share-top").data(rows).join("rect").attr("class", "share-top").attr("x", 0).attr("y", (_p, i) => y(i))
    .attr("width", (p) => x(p.top_share)).attr("height", y.bandwidth()).attr("fill", COLORS.accent);
  const remainder = c.g.selectAll(".share-rest").data(rows).join("rect").attr("class", "share-rest").attr("x", (p) => x(p.top_share))
    .attr("y", (_p, i) => y(i)).attr("width", (p) => x(1 - p.top_share)).attr("height", y.bandwidth()).attr("fill", COLORS.secondary);
  interactive(base, tip, onClick); interactive(remainder, tip, onClick);
  c.g.selectAll(".share-name").data(rows).join("text").attr("class", "share-name").attr("x", 5)
    .attr("y", (_p, i) => y(i) + y.bandwidth() / 2 + 3).attr("pointer-events", "none")
    .text((p) => p.top.player_name.split(" ").at(-1))
    .each(function (p) {
      const available = Math.max(1, x(p.top_share) - 10);
      const measured = this.getComputedTextLength?.() || this.textContent.length * 6;
      if (measured > available) d3.select(this).attr("textLength", available).attr("lengthAdjust", "spacingAndGlyphs");
    });
  c.g.selectAll(".value-label").data(rows).join("text").attr("class", "value-label").attr("x", c.width + 8)
    .attr("y", (_p, i) => y(i) + y.bandwidth() / 2 + 4).text((p) => percent(p.top_share, 0));
  const zero = clubs.filter((p) => !p.goals).length;
  if (zero) appendNote(container, `${zero} klub tanpa gol tidak ditampilkan karena persentasenya tidak terdefinisi.`);
}
export function heatmap(container, selected, leagueRows, { title = "" } = {}) {
  const profiles = percentileProfiles(selected, leagueRows);
  if (!profiles.length) return empty(container, "Pilih pemain dengan minimal 900 menit untuk perbandingan.");
  const c = canvas(container, { title, height: profiles.length * 65 + 155, margin: { left: 188, right: 12, top: 54, bottom: 100 } });
  const cellW = c.width / 6, cellH = 57;
  const color = d3.scaleLinear().domain([0, 100]).range(["#e2f1e5", "#13542c"]).interpolate(d3.interpolateRgb);
  const labels = ["Nonpenalti", "xG", "xA", "Umpan kunci", "Tembakan", "xGChain"];
  labels.forEach((label, i) => c.g.append("text").attr("class", "heat-heading").attr("x", (i + .5) * cellW).attr("y", -18).attr("text-anchor", "middle").text(label));
  profiles.forEach((profile, j) => {
    c.g.append("text").attr("class", "row-label").attr("x", -12).attr("y", j * 65 + cellH / 2 + 4).attr("text-anchor", "end").text(short(profile.player.player_name));
    const marks = c.g.selectAll(`.heat-row-${j}`).data(profile.values).join("rect").attr("class", `heat-cell heat-row-${j}`)
      .attr("x", (_v, i) => i * cellW + 2).attr("y", j * 65).attr("width", cellW - 4).attr("height", cellH).attr("rx", 3).attr("fill", (v) => color(v.percentile));
    interactive(marks, (v) => `${profile.player.player_name}\n${v.label}: ${number(v.raw, 3)} per 90\nPersentil: ${number(v.percentile, 1)}\nPembanding: seluruh pemain liga ≥900 menit`);
    c.g.selectAll(`.heat-number-${j}`).data(profile.values).join("text").attr("class", `heat-value heat-number-${j}`)
      .attr("x", (_v, i) => (i + .5) * cellW).attr("y", j * 65 + cellH / 2 + 5).attr("text-anchor", "middle")
      .attr("fill", (v) => v.percentile >= 58 ? "#fff" : "#102617").attr("pointer-events", "none").text((v) => number(v.percentile));
  });
  const legendY = profiles.length * 65 + 12;
  d3.range(101).forEach((p) => c.g.append("rect").attr("x", p * c.width / 101).attr("y", legendY).attr("width", c.width / 101 + .2).attr("height", 12).attr("fill", color(p)));
  [0, 25, 50, 75, 100].forEach((p) => c.g.append("text").attr("class", "axis-label").attr("x", p / 100 * c.width).attr("y", legendY + 29)
    .attr("text-anchor", p === 0 ? "start" : p === 100 ? "end" : "middle").text(p));
  c.g.append("text").attr("class", "axis-label").attr("x", c.width / 2).attr("y", legendY + 49).attr("text-anchor", "middle").text("Persentil metrik per 90 · lebih gelap = lebih tinggi");
}

export function facts(container, rows) {
  container.replaceChildren();
  if (!rows.length) return empty(container);
  const keeperGoals = rows
    .filter((p) => p.position_group === "GK")
    .reduce((s, p) => s + p.goals, 0);
  const keeperAssists = rows
    .filter((p) => p.position_group === "GK")
    .reduce((s, p) => s + p.assists, 0);
  const bestDefender = rank(
    rows.filter((p) => p.position_group === "D"),
    (p) => p.goals,
    1,
  )[0];
  const scorerNoAssist = rank(
    rows.filter((p) => !p.assists && p.goals > 0),
    (p) => p.goals,
    1,
  )[0];
  const creatorNoGoal = rank(
    rows.filter((p) => !p.goals && p.assists > 0),
    (p) => p.assists,
    1,
  )[0];
  const penaltyOnly = rank(
    rows.filter((p) => p.goals > 0 && p.npg === 0),
    (p) => p.goals,
    1,
  )[0];
  const entries = [
    [
      number(keeperGoals),
      "Gol dari penjaga gawang",
      rows.filter((p) => p.position_group === "GK" && p.goals > 0).map((p) => `${p.player_name} (${p.team_title})`).join(", ") || "Belum ada gol dari kiper dalam cakupan ini.",
    ],
    [
      number(keeperAssists),
      "Assist dari penjaga gawang",
      "Bukan hanya penyelamatan, kiper ikut menciptakan gol.",
    ],
    [
      bestDefender ? number(bestDefender.goals) : "—",
      "Bek dengan gol terbanyak",
      bestDefender?.player_name || "Belum ada bek dalam cakupan ini.",
    ],
    [
      scorerNoAssist ? number(scorerNoAssist.goals) : "—",
      "Gol tanpa satu pun assist",
      scorerNoAssist?.player_name || "Tidak ada pemain yang memenuhi kondisi.",
    ],
    [
      creatorNoGoal ? number(creatorNoGoal.assists) : "—",
      "Assist tanpa satu pun gol",
      creatorNoGoal?.player_name || "Tidak ada pemain yang memenuhi kondisi.",
    ],
    [
      penaltyOnly ? number(penaltyOnly.goals) : "—",
      "Seluruh golnya dari penalti",
      penaltyOnly?.player_name || "Tidak ada pemain yang memenuhi kondisi.",
    ],
  ];
  const grid = document.createElement("div");
  grid.className = "facts-grid";
  entries.forEach(([value, title, text]) => {
    const card = document.createElement("div");
    card.className = "fact";
    for (const [tag, content] of [
      ["strong", value],
      ["span", title],
      ["p", text],
    ]) {
      const el = document.createElement(tag);
      el.textContent = content;
      card.append(el);
    }
    grid.append(card);
  });
  container.append(grid);
}

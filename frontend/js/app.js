import {
  enrich,
  filterPlayers,
  rank,
  summary,
  clubSummary,
  positionSummary,
  finishingExtremes,
  csvCell,
  POSITION_LABELS,
} from "./analytics.js";
import * as charts from "./charts.js";

const organizer = document.body.dataset.audience === "organizer";
const $ = (selector) => document.querySelector(selector);
const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const n = (value, digits = 0) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(
        value,
      );
const pct = (value) => (value == null ? "—" : `${n(value * 100, 1)}%`);
const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  shield:
    '<path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18M7 16l4-5 4 2 5-8"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-1 9 5-3 5 3-1-9"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.chart}</svg>`;
const config = organizer
  ? {
      role: "Penyelenggara",
      nav: [
        ["overview", "grid", "Ringkasan"],
        ["club-cards", "shield", "Kartu per klub"],
        ["position-cards", "people", "Kartu per posisi"],
        ["card-thresholds", "chart", "Ambang kartu"],
        ["minute-bands", "clock", "Menit bermain"],
        ["penalty-clubs", "target", "Penalti per klub"],
        ["rotation", "people", "Rotasi pemain"],
        ["club-quality", "chart", "Gol vs xG klub"],
        ["goal-concentration", "chart", "Konsentrasi gol"],
        ["players", "people", "Data pemain"],
      ],
    }
  : {
      role: "Penonton",
      nav: [
        ["overview", "grid", "Ringkasan"],
        ["top-scorers", "award", "Top skor"],
        ["goal-contributions", "target", "Gol & assist"],
        ["finishing", "chart", "Gol vs xG pemain"],
        ["creators", "bolt", "Kreator peluang"],
        ["efficiency", "clock", "Efektivitas per 90"],
        ["season-facts", "info", "Fakta pemain"],
        ["club-heroes", "shield", "Andalan klub"],
        ["player-heatmap", "people", "Bandingkan pemain"],
        ["players", "people", "Data pemain"],
      ],
    };
const urlParams = new URLSearchParams(location.search);
const state = {
  all: [],
  filtered: [],
  meta: null,
  filters: {
    team: urlParams.get("team") || "",
    position: urlParams.get("position") || "",
    minutes: Math.max(0, Number(urlParams.get("minutes")) || 0),
  },
  search: "",
  page: 1,
  sort: organizer ? "yellow_cards" : "goals",
  direction: -1,
  per90Min: 900,
  compare: [],
  view: "overview",
  request: 0,
};
let toastTimer;
function toast(text) {
  window.clearTimeout(toastTimer);
  const element = $("#toast");
  element.textContent = text;
  element.hidden = false;
  toastTimer = window.setTimeout(() => {
    element.hidden = true;
  }, 3000);
}

function shell() {
  $("#app").innerHTML = `
    <aside class="sidebar" aria-label="Navigasi utama">
      <div class="sidebar-heading">
        <a class="brand" href="#overview">EPL Dashboard<span>Season 2020 / 21</span></a>
        <button type="button" id="menu-toggle" class="menu-toggle button" aria-expanded="false" aria-controls="sidebar-navigation">Menu</button>
      </div>
      <nav id="sidebar-navigation" class="side-nav" aria-label="Pilih visualisasi">${config.nav.map(([id, ic, label]) => `<a href="#${id}" class="nav-link" data-view="${id}">${icon(ic)}<span>${label}</span></a>`).join("")}</nav>
      <div class="side-bottom">
        <a class="switch-version" href="/${organizer ? "penonton" : "penyelenggara"}.html">${organizer ? "Dashboard penonton" : "Dashboard penyelenggara"} ${icon("arrow")}</a>
        <footer class="side-foot">© 2026 Intan Dwi Anggreini<br><span>Sains Data Terapan · PENS</span></footer>
      </div>
    </aside>
    <div class="workspace">
      <main id="main" class="main" tabindex="-1">
        <header id="overview" class="page-heading">
          <h1>Statistik Pemain EPL</h1>
          <p>Premier League 2020/21 · ${config.role} <span class="heading-divider">/</span> <span id="view-label">Ringkasan</span></p>
        </header>
        <form id="filters" class="filters" aria-label="Filter seluruh dashboard">
          <div class="filter-field wide"><label for="team-filter">Klub</label><select id="team-filter" class="select" disabled><option value="">Semua klub</option></select></div>
          <div class="filter-field"><label for="position-filter">Posisi</label><select id="position-filter" class="select" disabled><option value="">Semua posisi</option>${Object.entries(POSITION_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
          <div class="filter-field"><label for="minutes-filter">Minimal menit</label><select id="minutes-filter" class="select" disabled>${[[0, "Tanpa batas"], [450, "450 menit"], [900, "900 menit"], [1800, "1.800 menit"], [3000, "3.000 menit"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
          <div class="filter-meta"><span id="filter-count">Memuat dataset…</span><button type="button" class="button subtle" id="reset" disabled>${icon("refresh")} Reset</button><button id="export" type="button" class="button" disabled>${icon("download")} Ekspor CSV</button></div>
        </form>
        <p id="demo-banner" class="demo-badge" hidden>DATA DEMO SINTETIS · bukan statistik EPL asli</p>
        <p id="live-status" class="sr-only" role="status" aria-live="polite"></p>
        <div id="content" aria-busy="true"><div class="skeleton"></div></div>
      </main>
    </div>`;
  $("#filters").addEventListener("submit", (e) => e.preventDefault());
  $("#reset").addEventListener("click", () => {
    state.filters = { team: "", position: "", minutes: 0 };
    state.search = "";
    state.page = 1;
    syncFilters();
    render();
    toast("Semua filter direset.");
  });
  for (const [selector, key] of [["#team-filter", "team"], ["#position-filter", "position"], ["#minutes-filter", "minutes"]]) {
    $(selector).addEventListener("change", (e) => {
      state.filters[key] = key === "minutes" ? Number(e.target.value) : e.target.value;
      state.page = 1;
      render();
    });
  }
  $("#export").addEventListener("click", exportCSV);
  $("#menu-toggle").addEventListener("click", () => {
    const open = $(".sidebar").classList.toggle("menu-open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  $(".side-nav").addEventListener("click", (event) => {
    const link = event.target.closest(".nav-link");
    if (!link) return;
    event.preventDefault();
    const url = new URL(location.href);
    url.hash = link.dataset.view;
    history.pushState(null, "", url);
    applyView();
    $(".sidebar").classList.remove("menu-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#main").focus();
    $("#main").scrollIntoView?.({ block: "start" });
  });
  window.addEventListener("hashchange", applyView);
  window.addEventListener("popstate", applyView);
  applyView();
}

function applyView() {
  const legacy = { "card-histogram": "card-thresholds", "minute-histogram": "minute-bands", "goal-pareto": "goal-concentration", "player-radar": "player-heatmap" };
  const hash = location.hash.slice(1);
  const id = legacy[hash] || hash || "overview";
  state.view = config.nav.some(([key]) => key === id) ? id : "overview";
  const view = state.view;
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("#view-label").textContent = config.nav.find(([key]) => key === view)[2];
  const grid = $(".dashboard-grid");
  if (!grid) return;
  const home = view === "overview";
  grid.hidden = view === "players";
  grid.classList.toggle("is-focused", !home);
  $(".metric-grid").hidden = !home;
  document.querySelectorAll(".chart-card").forEach((card) => {
    card.hidden = !home && card.dataset.chart !== view;
  });
  $("#players").hidden = view !== "players";
}

function arrangeContent() {
  const content = $("#content");
  const grid = document.createElement("div");
  grid.className = "dashboard-grid";
  grid.setAttribute("aria-label", "Visualisasi statistik pemain");
  const cards = [...content.querySelectorAll(".chart-card")];
  cards[0].classList.add("primary-panel");
  cards[1].classList.add("secondary-panel");
  grid.append(content.querySelector(".metric-grid"), ...cards);
  const table = $("#players");
  content.replaceChildren(grid, table);
}

function syncFilters() {
  $("#team-filter").value = state.filters.team;
  $("#position-filter").value = state.filters.position;
  $("#minutes-filter").value = String(state.filters.minutes);
}
function selectClub(p) {
  state.filters.team = p.team_title;
  state.page = 1;
  syncFilters();
  render();
  toast(`Filter klub: ${p.team_title}`);
}
function metric(label, value) {
  return `<article class="metric"><h3>${h(label)}</h3><div class="metric-value">${h(value)}</div></article>`;
}
function card(id, title, { legend = "", controls = "" } = {}) {
  return `<article class="card chart-card" data-chart="${id}"><header class="card-head"><h2 class="chart-insight" id="${id}-insight">${h(title)}</h2>${legend ? `<div class="legend" aria-label="Legenda">${legend}</div>` : ""}</header>${controls}<div class="chart" id="${id}" tabindex="0" role="region" aria-labelledby="${id}-insight"></div></article>`;
}
const legend = (text, color) => `<span><i style="background:${color}"></i>${text}</span>`;
const stackLegend = (first, second) => legend(first, charts.COLORS.neutral) + legend(second, charts.COLORS.secondary) + legend("Sorotan pemimpin", charts.COLORS.accent);
function tableMarkup() {
  return `<section id="players"><div class="section-heading"><h2 class="section-title">Data pemain</h2><span>Urutkan, cari, dan ekspor</span></div><article class="card"><div class="table-toolbar"><label for="player-search" class="sr-only">Cari pemain dalam tabel</label><input id="player-search" class="search" type="search" placeholder="Cari nama pemain atau klub…" value="${h(state.search)}"><span class="table-status" id="table-count"></span></div><div class="data-table-wrap"><table class="data-table"><caption class="sr-only">Statistik pemain dalam cakupan filter. Klik judul kolom untuk mengubah urutan.</caption><thead><tr>${[
    ["player_name", "Pemain"],
    ["team_title", "Klub"],
    ["position", "Posisi"],
    ["time", "Menit"],
    ["goals", "Gol"],
    ["assists", "Assist"],
    ["xg", "xG"],
    ["yellow_cards", "Kuning"],
    ["red_cards", "Merah"],
  ]
    .map(
      ([key, label]) =>
        `<th scope="col" aria-sort="${state.sort === key ? (state.direction === 1 ? "ascending" : "descending") : "none"}"><button type="button" data-sort="${key}">${label} <span aria-hidden="true">${state.sort === key ? (state.direction === 1 ? "↑" : "↓") : "↕"}</span></button></th>`,
    )
    .join(
      "",
    )}</tr></thead><tbody id="player-rows"></tbody></table></div><div class="table-footer"><span>Menit dan statistik adalah akumulasi satu musim.</span><div class="pagination"><button class="button" id="prev-page" aria-label="Halaman sebelumnya">←</button><span id="page-label"></span><button class="button" id="next-page" aria-label="Halaman berikutnya">→</button></div></div></article></section>`;
}

const CHART_TITLES = {
  "club-cards": "Peringkat Kartu Kuning per Klub",
  "position-cards": "Kartu Kuning per 90 Menit menurut Posisi",
  "card-thresholds": "Ringkasan Kartu Kuning Pemain",
  "penalty-clubs": "Estimasi Penalti per Klub",
  "minute-bands": "Jumlah Pemain per Rentang Menit Bermain",
  "rotation": "Pemain Inti dan Pelapis per Klub",
  "club-quality": "Selisih Gol − xG per Klub",
  "goal-concentration": "Porsi Gol Pemain Teratas",
  "top-scorers": "Pencetak Gol Terbanyak",
  "goal-contributions": "Kontribusi Gol + Assist",
  "finishing": "Selisih Gol − xG Pemain",
  "creators": "Pemain Berdasarkan Umpan Kunci",
  "efficiency": "Gol + Assist per 90 Menit",
  "club-heroes": "Porsi Gol Top Skor per Klub",
  "player-heatmap": "Perbandingan Pemain per 90 Menit",
  "season-facts": "Fakta Menarik Pemain",
};
function chartTitle(id) {
  const top = (count, text) => count ? `Top ${Math.min(10, count)} ${text}` : CHART_TITLES[id];
  if (id === "top-scorers") return top(state.filtered.length, "Pencetak Gol");
  if (id === "goal-contributions") return top(state.filtered.length, "Kontribusi Gol + Assist");
  if (id === "creators") return top(state.filtered.length, "Pemain Berdasarkan Umpan Kunci");
  if (id === "efficiency") return top(state.filtered.filter((p) => p.time >= state.per90Min).length, "Gol + Assist per 90 Menit");
  if (id === "finishing") {
    const above = Math.min(5, state.filtered.filter((p) => p.finishing_delta > 0).length);
    const below = Math.min(5, state.filtered.filter((p) => p.finishing_delta < 0).length);
    if (above && below) return `Top ${above} di Atas & ${below} di Bawah xG`;
    if (above) return `Top ${above} Pemain di Atas xG`;
    if (below) return `Top ${below} Pemain di Bawah xG`;
  }
  if (id === "player-heatmap") {
    const count = state.compare.filter((id) => state.filtered.some((p) => p.id === id && p.time >= 900)).length;
    if (count) return `Perbandingan ${count} Pemain per 90 Menit`;
  }
  return CHART_TITLES[id];
}
function organizerContent(s) {
  return `<div class="metric-grid">${metric("Kartu kuning", n(s.yellow))}${metric("Kartu merah", n(s.red))}${metric("Gol penalti", n(s.penaltyGoals))}${metric("Beban tinggi", n(s.heavyMinutes))}</div>` +
    card("club-cards", chartTitle("club-cards")) +
    card("position-cards", chartTitle("position-cards")) +
    card("card-thresholds", chartTitle("card-thresholds")) +
    card("penalty-clubs", chartTitle("penalty-clubs"), { legend: stackLegend("Menjadi gol", "Gagal · estimasi") }) +
    card("minute-bands", chartTitle("minute-bands")) +
    card("rotation", chartTitle("rotation"), { legend: stackLegend("Inti ≥2.000 menit", "Pelapis <2.000 menit") }) +
    card("club-quality", chartTitle("club-quality")) +
    card("goal-concentration", chartTitle("goal-concentration"),
      { legend: legend("Gol kelompok teratas", charts.COLORS.accent) + legend("Gol pemain lain", charts.COLORS.secondary) }) + tableMarkup();
}
function spectatorContent(s) {
  return `<div class="metric-grid">${metric("Gol pemain", n(s.goals))}${metric("Assist", n(s.assists))}${metric("Expected goals", n(s.xg, 1))}${metric("Konversi tembakan", pct(s.shots ? s.goals / s.shots : null))}</div>` +
    card("top-scorers", chartTitle("top-scorers"), { legend: stackLegend("Gol nonpenalti", "Gol penalti") }) +
    card("goal-contributions", chartTitle("goal-contributions"), { legend: stackLegend("Gol", "Assist") }) +
    card("finishing", chartTitle("finishing")) +
    card("creators", chartTitle("creators")) +
    card("efficiency", chartTitle("efficiency"),
      { controls: `<div class="card-controls"><label for="efficiency-min">Minimal menit<select id="efficiency-min" class="select">${[900, 1800, 2700].map((v) => `<option value="${v}" ${v === state.per90Min ? "selected" : ""}>≥${n(v)} menit</option>`).join("")}</select></label><span id="efficiency-count" class="live-note"></span></div>` }) +
    card("club-heroes", chartTitle("club-heroes"), { legend: legend("Top skor klub", charts.COLORS.accent) + legend("Pemain lain", charts.COLORS.secondary) }) +
    card("player-heatmap", chartTitle("player-heatmap"), { controls: '<div id="heatmap-controls" class="card-controls"></div>' }) +
    card("season-facts", chartTitle("season-facts")) + tableMarkup();
}

function render() {
  charts.clearTooltip();
  state.filtered = filterPlayers(state.all, state.filters);
  const rows = state.filtered,
    s = summary(rows),
    clubs = clubSummary(rows);
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) url.searchParams.set(key, String(value));
    else url.searchParams.delete(key);
  }
  history.replaceState(null, "", url);
  $("#filter-count").textContent =
    `${n(rows.length)} / ${n(state.all.length)} pemain`;
  $("#live-status").textContent =
    `Filter diterapkan: ${rows.length} pemain. Semua grafik diperbarui.`;
  const content = $("#content");
  content.innerHTML = organizer
    ? organizerContent(s)
    : spectatorContent(s);
  arrangeContent();
  content.setAttribute("aria-busy", "false");
  if (organizer) {
    charts.bars($("#club-cards"), rank(clubs, (p) => p.yellow_cards, clubs.length), {
      key: "yellow_cards", name: (p) => p.team_title, xLabel: "Jumlah kartu kuning", title: chartTitle("club-cards"),
      annotation: { title: "MERAH", value: (p) => p.red_cards }, onClick: selectClub,
      label: (p) => `${p.team_title}\nKartu kuning: ${p.yellow_cards}\nKartu merah: ${p.red_cards}` });
    charts.verticalBars($("#position-cards"), rank(positionSummary(rows), (p) => p.rate, 4), {
      title: chartTitle("position-cards"), xLabel: "Kelompok posisi", yLabel: "Kartu kuning per 90 menit", highlight: (p) => p.id === "M",
      label: (p) => `${p.name}\n${n(p.rate, 3)} kartu kuning per 90\n${p.cards} kartu / ${n(p.minutes)} menit\n${p.count} pemain` });
    charts.discipline($("#card-thresholds"), rows);
    charts.minutes($("#minute-bands"), rows, { title: chartTitle("minute-bands") });
    charts.bars($("#penalty-clubs"), rank(clubs, (p) => p.penalty_attempts_est, clubs.length), {
      key: "penalty_goals", secondary: "penalty_missed_est", name: (p) => p.team_title, digits: 1,
      title: chartTitle("penalty-clubs"), xLabel: "Jumlah penalti · estimasi", onClick: selectClub,
      label: (p) => `${p.team_title}\nDiperoleh: ≈${n(p.penalty_attempts_est, 2)}\nGol: ${p.penalty_goals}\nGagal: ≈${n(p.penalty_missed_est, 2)}\nKonversi: ${pct(p.penalty_attempts_est ? p.penalty_goals / p.penalty_attempts_est : null)}` });
    charts.bars($("#rotation"), rank(clubs, (p) => p.player_count, clubs.length), {
      key: "core_count", secondary: "support_count", name: (p) => p.team_title, title: chartTitle("rotation"), xLabel: "Jumlah pemain", onClick: selectClub,
      label: (p) => `${p.team_title}\nInti ≥2.000 menit: ${p.core_count}\nPelapis <2.000 menit: ${p.support_count}\nTotal: ${p.player_count} pemain` });
    charts.diverging($("#club-quality"), rank(clubs, (p) => p.finishing_delta, clubs.length), {
      title: chartTitle("club-quality"), name: (p) => p.team_title, endpointsOnly: true, onClick: selectClub });
    charts.waffle($("#goal-concentration"), rows, { title: chartTitle("goal-concentration") });
  } else {
    charts.bars($("#top-scorers"), rank(rows, (p) => p.goals, 10), {
      key: "npg", secondary: "penalty_goals", title: chartTitle("top-scorers"), xLabel: "Jumlah gol",
      label: (p) => `${p.player_name}\n${p.team_title}\nNonpenalti: ${p.npg} · Penalti: ${p.penalty_goals}\nTotal gol: ${p.goals}` });
    charts.bars($("#goal-contributions"), rank(rows, (p) => p.goals + p.assists, 10), {
      key: "goals", secondary: "assists", title: chartTitle("goal-contributions"), xLabel: "Gol + assist",
      label: (p) => `${p.player_name}\nGol: ${p.goals} · Assist: ${p.assists}\nTotal G+A: ${p.goals + p.assists}` });
    charts.diverging($("#finishing"), finishingExtremes(rows), { title: chartTitle("finishing") });
    charts.creators($("#creators"), rows, { title: chartTitle("creators") });
    renderEfficiency();
    charts.clubShares($("#club-heroes"), clubs, { title: chartTitle("club-heroes"), onClick: selectClub });
    setupHeatmap();
    charts.facts($("#season-facts"), rows);
    $("#efficiency-min").addEventListener("change", (e) => { state.per90Min = Number(e.target.value); renderEfficiency(); });
  }
  setupTable();
  applyView();
}
function renderEfficiency() {
  const eligible = state.filtered.filter((p) => p.time >= state.per90Min);
  const top = rank(eligible, (p) => p.ga_per90, 10);
  $("#efficiency-insight").textContent = chartTitle("efficiency");
  $("#efficiency-count").textContent =
    `${n(eligible.length)} pemain memenuhi batas`;
  charts.bars($("#efficiency"), top, {
    key: "ga_per90",
    xLabel: "Gol + assist per 90 menit",
    digits: 2,
    title: chartTitle("efficiency"),
    label: (p) =>
      `${p.player_name}\n${n(p.ga_per90, 2)} G+A per 90\n${p.goals} gol + ${p.assists} assist\n${n(p.time)} menit`,
  });
}
function setupHeatmap() {
  const eligible = [...state.filtered]
    .filter((p) => p.time >= 900)
    .sort((a, b) => a.player_name.localeCompare(b.player_name));
  state.compare = state.compare.filter((id) =>
    eligible.some((p) => p.id === id),
  );
  const preferred = ["Harry Kane", "Mohamed Salah", "Bruno Fernandes"]
    .map((name) => eligible.find((p) => p.player_name === name))
    .filter(Boolean);
  const choices = [
    ...preferred,
    ...rank(eligible, (p) => p.goals + p.assists, 3),
  ];
  for (const p of choices) {
    if (state.compare.length >= Math.min(3, eligible.length)) break;
    if (!state.compare.includes(p.id)) state.compare.push(p.id);
  }
  const draw = () => {
    $("#player-heatmap-insight").textContent = chartTitle("player-heatmap");
    charts.heatmap(
      $("#player-heatmap"),
      state.compare
        .map((id) => state.all.find((p) => p.id === id))
        .filter(Boolean),
      state.all,
      { title: chartTitle("player-heatmap") },
    );
  };
  const updateControls = () => {
    $("#heatmap-controls").innerHTML = [0, 1, 2]
      .map(
        (i) =>
          `<label for="compare-${i}"><span class="sr-only">Pemain pembanding ${i + 1}</span><select id="compare-${i}" class="select" ${!eligible.length ? "disabled" : ""}><option value="">Pemain ${i + 1}…</option>${eligible.map((p) => `<option value="${p.id}" ${state.compare[i] === p.id ? "selected" : ""} ${state.compare.includes(p.id) && state.compare[i] !== p.id ? "disabled" : ""}>${h(p.player_name)}</option>`).join("")}</select></label>`,
      )
      .join("");
    for (let i = 0; i < 3; i++)
      $(`#compare-${i}`).addEventListener("change", (e) => {
        state.compare[i] = e.target.value ? Number(e.target.value) : null;
        updateControls();
        draw();
      });
  };
  updateControls();
  draw();
}
function tableRows() {
  const query = state.search.toLocaleLowerCase("id-ID");
  return state.filtered
    .filter((p) =>
      `${p.player_name} ${p.team_title}`
        .toLocaleLowerCase("id-ID")
        .includes(query),
    )
    .sort((a, b) => {
      const av = a[state.sort],
        bv = b[state.sort];
      return (
        (typeof av === "string" ? av.localeCompare(bv) : av - bv) *
          state.direction || a.id - b.id
      );
    });
}
function setupTable() {
  $("#player-search").addEventListener("input", (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderTable();
  });
  document.querySelectorAll("[data-sort]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      state.direction =
        state.sort === key
          ? -state.direction
          : typeof state.all[0]?.[key] === "string"
            ? 1
            : -1;
      state.sort = key;
      state.page = 1;
      renderTable();
    }),
  );
  $("#prev-page").addEventListener("click", () => {
    state.page--;
    renderTable();
  });
  $("#next-page").addEventListener("click", () => {
    state.page++;
    renderTable();
  });
  renderTable();
}
function renderTable() {
  const rows = tableRows(),
    pages = Math.max(1, Math.ceil(rows.length / 10));
  state.page = Math.max(1, Math.min(pages, state.page));
  $("#table-count").textContent =
    `${n(rows.length)} pemain · pencarian hanya untuk tabel`;
  $("#player-rows").innerHTML =
    rows
      .slice((state.page - 1) * 10, state.page * 10)
      .map(
        (p) =>
          `<tr><td>${h(p.player_name)}${p.is_transfer ? '<span class="transfer-tag">Transfer</span>' : ""}</td><td>${h(p.team_title.replaceAll(",", " / "))}</td><td><span class="position-pill">${h(p.position)}</span></td><td>${n(p.time)}</td><td>${n(p.goals)}</td><td>${n(p.assists)}</td><td>${n(p.xg, 2)}</td><td>${n(p.yellow_cards)}</td><td>${n(p.red_cards)}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="9">Tidak ada pemain yang cocok. Ubah pencarian atau reset filter.</td></tr>';
  $("#page-label").textContent = `${state.page} / ${pages}`;
  $("#prev-page").disabled = state.page === 1;
  $("#next-page").disabled = state.page === pages;
  document.querySelectorAll("[data-sort]").forEach((b) => {
    const active = b.dataset.sort === state.sort;
    b.parentElement.setAttribute(
      "aria-sort",
      active ? (state.direction === 1 ? "ascending" : "descending") : "none",
    );
    b.querySelector("span").textContent = active
      ? state.direction === 1
        ? "↑"
        : "↓"
      : "↕";
  });
}
function exportCSV() {
  const fields = [
    "id",
    "player_name",
    "team_title",
    "position",
    "games",
    "time",
    "goals",
    "assists",
    "xg",
    "xa",
    "shots",
    "key_passes",
    "yellow_cards",
    "red_cards",
    "npg",
    "npxg",
    "xgchain",
    "xgbuildup",
    "ga_per90",
  ];
  const rows = tableRows();
  if (!rows.length) {
    toast("Tidak ada data untuk diekspor.");
    return;
  }
  const metadataMode =
    state.meta.mode === "demo" ? "DEMO-SINTETIS" : "snapshot-20210523";
  const csv =
    "\uFEFF" +
    [
      fields.map(csvCell).join(","),
      ...rows.map((p) => fields.map((f) => csvCell(p[f])).join(",")),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `epl-${organizer ? "penyelenggara" : "penonton"}-${metadataMode}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${rows.length} pemain diekspor sesuai filter dan pencarian tabel.`);
}
async function load() {
  const request = ++state.request;
  try {
    const response = await fetch("/api/data", {
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "API belum siap.");
    if (!Array.isArray(payload.players) || !payload.meta)
      throw new Error("Format respons dataset tidak valid.");
    if (request !== state.request) return;
    state.all = payload.players.map(enrich);
    state.meta = payload.meta;
    $("#demo-banner").hidden = state.meta.mode !== "demo";
    const teams = [
      ...new Set(
        state.all.filter((p) => !p.is_transfer).map((p) => p.team_title),
      ),
    ].sort();
    $("#team-filter").innerHTML =
      '<option value="">Semua klub</option>' +
      teams.map((t) => `<option value="${h(t)}">${h(t)}</option>`).join("");
    if (!teams.includes(state.filters.team)) state.filters.team = "";
    if (!Object.hasOwn(POSITION_LABELS, state.filters.position))
      state.filters.position = "";
    if (![0, 450, 900, 1800, 3000].includes(state.filters.minutes))
      state.filters.minutes = 0;
    syncFilters();
    document
      .querySelectorAll("#filters select,#filters button,#export")
      .forEach((el) => (el.disabled = false));
    render();
  } catch (error) {
    if (request !== state.request) return;
    $("#content").setAttribute("aria-busy", "false");
    $("#content").innerHTML =
      `<section class="error-state"><h2>Data belum dapat ditampilkan.</h2><p>${h(error.name === "TimeoutError" ? "Permintaan melewati batas waktu. Pastikan layanan API dan database berjalan." : error.message)}</p><button id="retry" class="button primary">${icon("refresh")} Coba lagi</button></section>`;
    $("#filter-count").textContent = "Koneksi belum tersedia";
    $("#retry").addEventListener("click", load);
  }
}
shell();
load();

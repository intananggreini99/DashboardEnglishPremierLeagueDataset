/** Intentionally fictional, reproducible data. Never presented as EPL statistics. */
import { writeFile } from "node:fs/promises";
const headers = [
  "",
  "id",
  "player_name",
  "games",
  "time",
  "goals",
  "xG",
  "assists",
  "xA",
  "shots",
  "key_passes",
  "yellow_cards",
  "red_cards",
  "position",
  "team_title",
  "npg",
  "npxG",
  "xGChain",
  "xGBuildup",
];
let seed = 202021;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const integer = (a, b) => Math.floor(random() * (b - a + 1)) + a;
const rounded = (n) => Math.round(n * 1000) / 1000;
const first = [
  "Arka",
  "Bima",
  "Cakra",
  "Damar",
  "Evan",
  "Fajar",
  "Gilang",
  "Hadi",
  "Ilham",
  "Jaya",
  "Kris",
  "Laras",
  "Mika",
  "Nanda",
  "Oka",
  "Putra",
  "Raka",
  "Sena",
  "Tama",
  "Wira",
];
const rows = [];
for (let club = 1; club <= 20; club++)
  for (let member = 0; member < 6; member++) {
    const id = rows.length + 1;
    const primary = ["GK", "D", "M", "F", "M", "S"][member];
    const minutes =
      member === 5 ? integer(15, 400) : integer(member === 3 ? 900 : 450, 3420);
    const games = Math.min(38, Math.max(1, Math.ceil(minutes / 80)));
    const npg =
      primary === "F"
        ? integer(2, 22)
        : primary === "M"
          ? integer(0, 10)
          : primary === "D"
            ? integer(0, 5)
            : 0;
    const penalties = ["F", "M"].includes(primary) ? integer(0, 5) : 0;
    const attempts =
      penalties + (["F", "M"].includes(primary) ? integer(0, 2) : 0);
    const goals = npg + penalties;
    const shots = Math.max(
      goals,
      primary === "GK" ? 0 : integer(goals * 2 + 1, goals * 3 + 50),
    );
    const npxg = rounded(npg * 0.65 + random() * 6);
    const xg = rounded(npxg + attempts * 0.76);
    const assists =
      primary === "M"
        ? integer(0, 12)
        : primary === "F"
          ? integer(0, 8)
          : primary === "D"
            ? integer(0, 6)
            : integer(0, 1);
    const xa = rounded(assists * 0.6 + random() * 4);
    const keypasses =
      primary === "GK" ? integer(0, 2) : integer(assists * 3, assists * 3 + 40);
    const yellow =
      primary === "M" || primary === "D" ? integer(0, 12) : integer(0, 5);
    const red = random() < 0.12 ? integer(1, 2) : 0;
    const position =
      primary === "S"
        ? "S"
        : `${primary}${member > 0 && random() < 0.8 ? " S" : ""}`;
    const team = `Klub Demo ${String(club).padStart(2, "0")}`;
    rows.push([
      rows.length,
      id,
      `${first[(id - 1) % first.length]} Demo ${String(id).padStart(3, "0")}`,
      games,
      minutes,
      goals,
      xg,
      assists,
      xa,
      shots,
      keypasses,
      yellow,
      red,
      position,
      team,
      npg,
      npxg,
      rounded(xg + xa + random() * 8),
      rounded(random() * 15),
    ]);
  }
// Multi-club rows exercise the explicit exclusion policy in club aggregates.
for (let i = 0; i < 4; i++) {
  const p = [...rows[3 + i * 6]];
  p[0] = rows.length;
  p[1] = rows.length + 1;
  p[2] = `Transfer Demo ${i + 1}`;
  p[14] = `Klub Demo ${String(i + 1).padStart(2, "0")},Klub Demo ${String(i + 2).padStart(2, "0")}`;
  rows.push(p);
}
const cell = (v) => `"${String(v).replaceAll('"', '""')}"`;
await writeFile(
  new URL("../data/demo-synthetic.csv", import.meta.url),
  [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n",
);
console.log(
  `${rows.length} baris sintetis ditulis ke data/demo-synthetic.csv. Ini bukan dataset EPL asli.`,
);

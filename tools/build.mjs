// Baut die Lesemappe nach _site/: Startseite, eine Seite und ein PDF je Lektion, Elternseite.
// Inhalte: lektionen/<nr>.json, seiten/eltern.html. Bilder: site/img (aus tools/bilder.py).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rutsche, silben } from "./geometrie.mjs";
import { lektionPdf } from "./pdf.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aus = path.join(root, "_site");
const BALD = 3; // so viele „kommt bald“-Karten nach der letzten Lektion

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const bild = (name, alt = "", basis = "", extra = "") =>
  `<img src="${basis}img/${name}.webp" alt="${esc(alt)}"${extra ? " " + extra : ""} loading="lazy" decoding="async">`;

const NAMEN = {
  kirsche: "Kirschen", kaese: "Käse", kuchen: "Kuchen", marmelade: "Marmelade", eis: "Eis", pommes: "Pommes",
  schokolade: "Schokolade", lola: "Lola", mama: "Mama", oma: "Oma", lama: "Lama", monster: "Monster Mo",
};

/** Wort mit farbigen Silben; Satzzeichen bleiben schwarz. */
function silbenHtml(wort, mitLuecke = false) {
  const [, kern, zeichen] = wort.match(/^(.*?)([.,!?]*)$/);
  const teile = silben(kern).map((s, i) => `<span class="s${(i % 2) + 1}">${esc(s)}</span>`);
  return `<span class="wort">${teile.join(mitLuecke ? '<span class="silbe-luecke"></span>' : "")}${esc(zeichen)}</span>`;
}

const ELTERN = {
  rutschen: "Das Kind „rutscht“ mit dem Finger die Rutsche hinunter und zieht dabei die Laute lang: Lllooolllaaa. Laute sprechen, nicht Buchstabennamen: „mmm“, nicht „em“. Erst danach das Wort normal sagen. Der Knopf zeigt das Tempo, die Stimme kommt erst am Ende.",
  herzen: "Das Herz heißt „mag“. Das Kind liest den Namen und sagt den Satz mit dem Bild: „Lola mag Kirschen.“ Die Lücke zeigt die Silben. Danach malt es das Herz an. Wer das Bild antippt, hört den Satz.",
  monster: "Unsinnsilben sind Absicht: Das Kind kann sie nicht raten, es muss jeden Laut lesen. Erst langsam, an späteren Tagen schneller. Jede gelesene Reihe abhaken.",
  flug: "Das Flugzeug landet auf einer Silbe, das Kind liest sie. Etwa 20 Flüge am Tag reichen. So wird aus mühsamem Zusammenziehen schnelles Erkennen.",
  geschichte: "Die Geschichte hat nur Buchstaben, die das Kind schon kennt; die Bilder ersetzen die anderen Wörter. Erst selbst lesen, dann vorlesen lassen (Lautsprecher). Die Fragen liest ein Erwachsener vor, die Antworten liest das Kind selbst. Danach nacherzählen lassen: Wer mag was?",
  bauen: "Schreiben hilft beim Lesen. Das Kind sagt das Wort langsam und sucht Laut für Laut den passenden Stein. Ein falscher Stein ist immer dabei. Noch besser auf Papier: Buchstabenkarten aus dem PDF oder Magnetbuchstaben am Kühlschrank.",
  tage: "Jeden Tag einmal lesen, etwa 10 Minuten. Danach malt das Kind einen Stern an. Das ersetzt die Unterschrift im Tagesfeld auf dem Papierblatt.",
};

function elternTipp(teil) {
  return `<details class="eltern"><summary>Für Eltern</summary><p>${esc(ELTERN[teil])}</p></details>`;
}

function seite({ titel, basis, body, beschreibung }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<meta name="theme-color" content="#fffdf8">
<link rel="icon" href="${basis}img/stern.webp" type="image/webp">
<link rel="preload" href="${basis}fonts/andika-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${basis}fonts/andika-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${basis}css/lesemappe.css">
<script>window.LESEMAPPE_BASIS = ${JSON.stringify(basis)};</script>
<script src="${basis}js/lesemappe.js" type="module"></script>
</head>
<body>
${body}
</body>
</html>
`;
}

// ── Lektion ─────────────────────────────────────────────

function abschnitt(id, symbol, titel, auftrag, inhalt, teil = id) {
  return `<section class="abschnitt" id="${id}" aria-labelledby="${id}-titel">
<header>${bild(symbol, "", "../../")}<div><h2 id="${id}-titel">${esc(titel)}</h2><p class="auftrag">${esc(auftrag)}</p></div></header>
${inhalt}
${elternTipp(teil)}
</section>`;
}

function lektionHtml(l) {
  const b = "../../";
  const rutschenHtml = l.rutschen.map((r) => {
    const g = rutsche(r.wort);
    const laute = g.laute.map((x) =>
      `<span class="laut" style="left:${x.x.toFixed(1)}%;top:${x.y.toFixed(1)}%" data-t="${x.von.toFixed(3)}" data-bis="${x.bis.toFixed(3)}">${esc(x.zeichen)}</span>`).join("");
    const bahn = g.kugel.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(";");
    return `<div class="rutsche" data-wort="${esc(r.wort)}" data-bahn="${bahn}">
<div class="buehne" role="img" aria-label="Rutsche: ${esc([...r.wort].join(" "))}">${bild("rutsche", "", b)}${laute}<span class="kugel"></span></div>
<div class="ergebnis">${silbenHtml(r.wort)} ${bild(r.bild, NAMEN[r.bild] ?? "", b)}</div>
<button class="knopf" type="button">Rutschen!</button>
</div>`;
  }).join("\n");

  const herzHtml = l.herzsaetze.map((h) => `<div class="herzsatz">
<span class="wort">${h.silben.map((s, i) => `<span class="s${(i % 2) + 1}">${esc(s)}</span>`).join('<span class="silbe-luecke"></span>')}</span>
<button type="button" data-herz aria-pressed="false" aria-label="Gelesen: Herz anmalen">${bild("herz-leer", "", b)}</button>
<button type="button" class="bild" data-sprich="${esc(h.satz)}" aria-label="Satz anhören">${bild(h.bild, NAMEN[h.bild] ?? "", b)}</button>
</div>`).join("\n");

  const monsterHtml = `<div class="monster-feld">${bild("monster", "Monster Mo liest", b)}<div class="monster-reihen">
${l.monsterreihen.map((r) => `<button type="button" class="monster-reihe" aria-pressed="false"><span>${esc(r)}</span><span class="haken" aria-hidden="true"></span></button>`).join("\n")}
</div></div>`;

  const teppichHtml = `<div data-flug="${l.fluege}">
<div class="flug-steuer"><button class="knopf" type="button" data-los>Losfliegen!</button><span class="flug-zaehler" aria-live="polite"></span><span class="flug-leiste"><span></span></span></div>
<div class="teppich-rahmen"><img class="flieger" src="${b}img/flugzeug.webp" alt="">
<div class="teppich">${l.silbenteppich.flat().map((s) => `<button type="button">${esc(s)}</button>`).join("")}</div></div>
</div>`;

  const g = l.geschichte;
  const zeile = (teile) => `<p>${teile.map((t) => {
    if (t === "♥") return bild("herz", "mag", b, 'class="herz"');
    if (NAMEN[t] && /^[a-z]/.test(t)) return bild(t, NAMEN[t], b);
    if (t === "!") return "<span>!</span>";
    return silbenHtml(t);
  }).join(" ")}</p>`;
  const fragenHtml = g.fragen.map((f) => `<div class="frage">
<div class="frage-kopf"><button class="vorlesen" type="button" data-sprich="${esc(f.frage)}" aria-label="Frage anhören">🔊</button><span>${esc(f.frage)}</span></div>
<div class="antworten">${f.antworten.map((a) => `<button type="button" data-richtig="${a === f.richtig ? "ja" : "nein"}">${f.art === "bild" ? bild(a, NAMEN[a] ?? a, b) : silbenHtml(a)}</button>`).join("")}</div>
</div>`).join("\n");
  const geschichteHtml = `<div class="geschichte"><div class="geschichte-text">
<h3 style="margin:0 0 6px">${silbenHtml(g.titel)}</h3>
${g.zeilen.map(zeile).join("\n")}
<p style="margin-top:12px"><button class="knopf leise" type="button" data-stimme data-sprich="${esc(g.vorlesen)}">🔊 Anhören</button></p>
</div>${bild(g.bild, "", b)}</div>
<div class="fragen">${fragenHtml}</div>`;

  const bauenHtml = `<div data-bauen='${esc(JSON.stringify(l.bauen))}'>
<div class="bauen"><div class="bild"><img src="${b}img/${l.bauen[0].bild}.webp" alt=""></div>
<div><div class="plaetze" role="group"></div><div class="steine"></div></div></div>
<div class="bauen-fuss"><span class="bauen-zaehler"></span><button class="knopf gruen" type="button" data-naechstes hidden>Nächstes Wort →</button></div>
<noscript><p>Wörter bauen braucht JavaScript. Die Buchstabenkarten im PDF gehen auch ohne.</p></noscript>
</div>`;

  const tageHtml = `<div class="tage">${Array.from({ length: 7 }, (_, i) =>
    `<button type="button" aria-pressed="false" aria-label="Tag ${i + 1}">${bild("stern-leer", "", b)}<span>${i + 1}. Tag</span></button>`).join("")}</div>`;

  const teile = [
    ["rutschen", "rutsche", "Rutschen"],
    ["herzen", "herz", "Wer mag was?"],
    ["monster", "monster", "Monster Mo"],
    ["flug", "flugzeug", "Silbenflug"],
    ["geschichte", "buch", "Geschichte"],
    ["bauen", "lola", "Wörter bauen"],
    ["tage", "stern", "Lesetage"],
  ];
  const reiter = `<nav class="reiter" aria-label="Abschnitte">${teile.map(([id, sym, t]) => `<a href="#${id}">${bild(sym, "", b)}<span>${esc(t)}</span></a>`).join("")}</nav>`;

  const body = `<div class="seite" data-lektion="lektion-${l.nr}">
<div class="kopf"><a class="zurueck" href="${b}">← Alle</a><span class="platz"></span>
<a class="pdf-knopf" href="${b}pdf/leseblatt-${l.nr}.pdf" download>⬇ PDF<span class="lang"> zum Ausdrucken</span></a></div>
<div class="lektion-kopf"><span class="buchstabe" aria-hidden="true">${esc(l.buchstabe)}</span>
<div><div class="unter">Leseblatt ${l.nr}</div><h1>${esc(l.titel)}</h1><div class="laute" aria-label="Laute">${l.laute.map((x) => `<span>${esc(x)}${esc(x.toLowerCase())}</span>`).join("")}</div></div></div>
${reiter}
${abschnitt("rutschen", "rutsche", "Rutschen", "Rutsch mit! Zieh die Laute ganz lang.", `<div class="rutschen">${rutschenHtml}</div>`)}
${abschnitt("herzen", "herz", "Wer mag was?", "Lies den Namen. Dann mal das Herz an.", `<div class="herzsaetze">${herzHtml}</div>`)}
${abschnitt("monster", "monster", "Monster Mo", "Mo liest komische Wörter. Kannst du das auch?", monsterHtml)}
${abschnitt("flug", "flugzeug", "Silbenflug", "Wo landet das Flugzeug? Lies die Silbe!", teppichHtml)}
${abschnitt("geschichte", "buch", `Geschichte: ${g.titel}`, "Lies die Geschichte. Dann beantworte die Fragen.", geschichteHtml)}
${abschnitt("bauen", "lola", "Wörter bauen", "Tipp die Buchstaben der Reihe nach an.", bauenHtml)}
${abschnitt("tage", "stern", "Lesetage", "Jeden Tag einmal lesen. Dann einen Stern anmalen.", tageHtml)}
<p class="fuss"><a href="${b}eltern/">Für Eltern: So übt ihr mit der Lesemappe</a></p>
</div>`;
  return seite({ titel: `Leseblatt ${l.nr}: ${l.titel} – Lesemappe`, basis: b, body, beschreibung: `Lesen üben mit ${l.laute.join(", ")}: Rutschen, Silbenflug, Geschichte und Wörter bauen.` });
}

// ── Startseite ──────────────────────────────────────────

function startHtml(lektionen) {
  const karten = lektionen.map((l) => `<a class="lektion-karte" href="lektion/${l.nr}/">
<span class="gross" aria-hidden="true">${esc(l.buchstabe)}</span>
${bild(l.rutschen[0].bild, "", "", 'class="figur"')}
<span class="nr">Leseblatt ${l.nr}</span><span class="name">${esc(l.titel)}</span>
<span class="sterne" data-sterne="lektion-${l.nr}" aria-hidden="true">${Array.from({ length: 7 }, () => bild("stern-leer")).join("")}</span></a>`);
  const letzte = lektionen.at(-1)?.nr ?? 0;
  for (let i = 1; i <= BALD; i++) {
    karten.push(`<div class="lektion-karte bald" aria-label="Leseblatt ${letzte + i} kommt bald"><span class="gross" aria-hidden="true">?</span><span class="nr">Leseblatt ${letzte + i}</span><span class="name">kommt bald</span></div>`);
  }
  const body = `<div class="seite">
<div class="titelbild"><h1 style="margin:0">${bild("schrift-lesemappe", "Lesemappe", "", 'class="schrift"')}</h1>${bild("sonne", "", "", 'class="sonne"')}</div>
<p class="hallo" data-hallo><span data-gruss>Hallo!</span> <input type="text" hidden maxlength="30" aria-label="Name des Kindes" autocomplete="off"> <button type="button">Name eintragen</button></p>
<div class="lektionen">${karten.join("\n")}</div>
<div class="eltern-hinweis">${bild("buch")}<div><p><strong>Für Eltern:</strong> Jeden Tag etwa 10 Minuten, gemeinsam am Tablet oder auf Papier. Jedes Leseblatt gibt es auch als PDF zum Ausdrucken.</p>
<a href="eltern/">So übt ihr mit der Lesemappe – und warum</a></div></div>
</div>`;
  return seite({ titel: "Lesemappe", basis: "", body, beschreibung: "Lesen lernen mit Silben, Rutschen und Monster Mo: die Leseblätter aus der Schule zum Mitmachen und Ausdrucken." });
}

function elternHtml() {
  const inhalt = readFileSync(path.join(root, "seiten", "eltern.html"), "utf8");
  const body = `<div class="seite"><div class="kopf"><a class="zurueck" href="../">← Lesemappe</a></div><article class="text">${inhalt}</article></div>`;
  return seite({ titel: "Für Eltern – Lesemappe", basis: "../", body, beschreibung: "Wie Kinder lesen lernen und wie ihr mit der Lesemappe übt: Laute, Silben, wiederholtes Lesen, Verstehen." });
}

// ── Bauen ───────────────────────────────────────────────

const schreib = (datei, inhalt) => {
  mkdirSync(path.dirname(datei), { recursive: true });
  writeFileSync(datei, inhalt);
};

rmSync(aus, { recursive: true, force: true, maxRetries: 5 });
cpSync(path.join(root, "site"), aus, { recursive: true });

const lektionen = readdirSync(path.join(root, "lektionen"))
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(path.join(root, "lektionen", f), "utf8")))
  .sort((a, b) => a.nr - b.nr);

schreib(path.join(aus, "index.html"), startHtml(lektionen));
schreib(path.join(aus, "eltern", "index.html"), elternHtml());
for (const l of lektionen) {
  schreib(path.join(aus, "lektion", String(l.nr), "index.html"), lektionHtml(l));
  schreib(path.join(aus, "pdf", `leseblatt-${l.nr}.pdf`), await lektionPdf(l));
}
schreib(path.join(aus, "robots.txt"), "User-agent: *\nDisallow: /\n");
schreib(path.join(aus, "_headers"), `/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
/img/*
  Cache-Control: public, max-age=604800
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/pdf/*
  Content-Disposition: attachment
`);

// Prüfen: jede lokale Adresse in den Seiten muss es geben
let fehler = 0;
const seiten = [];
const sammeln = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) sammeln(p); else if (e.name.endsWith(".html")) seiten.push(p);
});
sammeln(aus);
for (const s of seiten) {
  const html = readFileSync(s, "utf8");
  for (const [, url] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    let ziel = path.resolve(path.dirname(s), url);
    if (url.endsWith("/")) ziel = path.join(ziel, "index.html");
    if (!existsSync(ziel)) { console.error(`fehlt: ${url} (in ${path.relative(aus, s)})`); fehler++; }
  }
  for (const [, name] of html.matchAll(/img\/([\w-]+)\.webp/g)) {
    if (!existsSync(path.join(aus, "img", `${name}.webp`))) { console.error(`Bild fehlt: ${name}`); fehler++; }
  }
}
if (fehler) { console.error(`${fehler} Fehler`); process.exit(1); }
console.log(`_site: ${seiten.length} Seiten, ${lektionen.length} PDF(s)`);

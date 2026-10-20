// Leseblatt als PDF (A4, zwei Seiten):
// 1. wie das Blatt aus der Schule: Rutschen, Herzsätze, Monsterreihen, Silbenteppich, Tagesfelder
// 2. neu: Geschichte mit Fragen und Buchstabenkarten zum Ausschneiden
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import fontkit from "@cantoo/fontkit";
import { rutsche, silben } from "./geometrie.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 595.28, H = 841.89, M = 36;

const hex = (h) => rgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const tinte = hex("#222226"), grau = hex("#8a867e"), linie = hex("#c9c4b9"), silbe1 = hex("#1f6fb8"), silbe2 = hex("#c8302a");

export async function lektionPdf(l) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Leseblatt ${l.nr}: ${l.titel}`);
  doc.setLanguage("de-DE");
  doc.setAuthor("Lesemappe");
  const font = await doc.embedFont(readFileSync(path.join(root, "tools/fonts/Andika-Regular.ttf")), { subset: true });
  const fett = await doc.embedFont(readFileSync(path.join(root, "tools/fonts/Andika-Bold.ttf")), { subset: true });
  const bilder = {};
  const bildVon = async (name) => (bilder[name] ??= await doc.embedPng(readFileSync(path.join(root, "generated/klein", `${name}.png`))));

  // y wächst nach unten wie auf dem Papier; umgerechnet wird nur hier
  const text = (p, s, x, y, size, { f = font, color = tinte } = {}) => p.drawText(s, { x, y: H - y - size * 0.8, size, font: f, color });
  const breite = (s, size, f = font) => f.widthOfTextAtSize(s, size);
  const rahmen = (p, x, y, w, h, { dick = 1, farbe = tinte, gestrichelt = false } = {}) =>
    p.drawRectangle({ x, y: H - y - h, width: w, height: h, borderColor: farbe, borderWidth: dick, ...(gestrichelt ? { borderDashArray: [5, 4] } : {}) });
  const strich = (p, x1, y1, x2, y2, farbe = tinte, dick = 1) => p.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: dick, color: farbe });
  const malen = async (p, name, x, y, { w, h }) => {
    const img = await bildVon(name);
    const s = Math.min((w ?? Infinity) / img.width, (h ?? Infinity) / img.height);
    p.drawImage(img, { x, y: H - y - img.height * s, width: img.width * s, height: img.height * s });
    return { w: img.width * s, h: img.height * s };
  };
  // Wort mit Silbenfarben; gibt die Breite zurück
  const silbenText = (p, wort, x, y, size, luecke = 0) => {
    const [, kern, zeichen] = wort.match(/^(.*?)([.,!?]*)$/);
    let cx = x;
    silben(kern).forEach((s, i) => {
      text(p, s, cx, y, size, { f: fett, color: i % 2 ? silbe2 : silbe1 });
      cx += breite(s, size, fett) + luecke;
    });
    if (luecke) cx -= luecke;
    if (zeichen) { text(p, zeichen, cx, y, size, { f: fett }); cx += breite(zeichen, size, fett); }
    return cx - x;
  };

  // ── Seite 1 ──
  const p1 = doc.addPage([W, H]);
  rahmen(p1, M, M, W - 2 * M, 44);
  strich(p1, M + 150, M, M + 150, M + 44);
  strich(p1, W - M - 90, M, W - M - 90, M + 44);
  text(p1, `Leseblatt ${l.nr}`, M + 16, M + 13, 18);
  text(p1, "Name:", M + 166, M + 13, 18);
  strich(p1, M + 222, M + 33, W - M - 106, M + 33, linie);
  text(p1, l.buchstabe, W - M - 45 - breite(l.buchstabe, 30, fett) / 2, M + 6, 30, { f: fett });
  text(p1, "Jeden Tag einmal lesen. Danach unten ein Tagesfeld anmalen.", M, M + 54, 10, { color: grau });

  // Rutschen
  const rw = (W - 2 * M - 40) / 3;
  for (const [i, r] of l.rutschen.entries()) {
    const x0 = M + i * (rw + 20), y0 = M + 80;
    const g = rutsche(r.wort);
    const { w, h } = await malen(p1, "rutsche", x0, y0, { w: rw });
    for (const laut of g.laute) {
      const size = 20;
      text(p1, laut.zeichen, x0 + (laut.x / 100) * w - breite(laut.zeichen, size) / 2, y0 + (laut.y / 100) * h - size / 2, size);
    }
  }

  // Herzsätze links, Monster rechts
  let y = M + 245;
  const zeileH = 42;
  for (const hs of l.herzsaetze) {
    let x = M + 20;
    hs.silben.forEach((s, i) => {
      text(p1, s, x, y, 24, { f: font, color: i % 2 ? silbe2 : silbe1 });
      x += breite(s, 24) + 7;
    });
    await malen(p1, "herz-leer", M + 125, y - 4, { h: 32 });
    await malen(p1, hs.bild, M + 175, y - 6, { w: 40, h: 36 });
    y += zeileH;
  }
  await malen(p1, "monster", M + 300, M + 250, { h: 76 });
  let my = M + 335;
  for (const r of l.monsterreihen) {
    text(p1, r, M + 330, my, 24);
    my += 44;
  }

  // Silbenteppich
  const ty = M + 555;
  await malen(p1, "flugzeug", M, ty - 6, { w: 52 });
  text(p1, `Hier zeigt ihr auf die Silbe, die gelesen werden soll. Ca. ${l.fluege} „Flüge“.`, M + 60, ty, 10, { color: grau });
  const spalten = l.silbenteppich[0].length, zellW = (W - 2 * M - 20) / spalten, zellH = 30;
  l.silbenteppich.forEach((reihe, ri) => reihe.forEach((s, ci) => {
    const x = M + 10 + ci * zellW, yy = ty + 20 + ri * zellH;
    rahmen(p1, x, yy, zellW, zellH, { dick: 0.8 });
    text(p1, s, x + (zellW - breite(s, 17)) / 2, yy + 7, 17);
  }));

  // Tagesfelder
  const fy = ty + 20 + l.silbenteppich.length * zellH + 22;
  text(p1, "Gelesen am …", M, fy, 11, { color: grau });
  const fw = (W - 2 * M) / 7;
  for (let i = 0; i < 7; i++) {
    rahmen(p1, M + i * fw + 3, fy + 16, fw - 6, 48, { dick: 0.8, farbe: linie });
    text(p1, `${i + 1}. Tag`, M + i * fw + 9, fy + 20, 9, { color: grau });
    await malen(p1, "stern-leer", M + i * fw + fw / 2 - 2, fy + 32, { h: 28 });
  }

  // ── Seite 2 ──
  const p2 = doc.addPage([W, H]);
  const g = l.geschichte;
  text(p2, `Leseblatt ${l.nr} · Geschichte`, M, M, 11, { color: grau });
  await malen(p2, g.bild, W - M - 90, M + 10, { h: 120 });
  silbenText(p2, g.titel, M, M + 24, 34);
  y = M + 80;
  for (const z of g.zeilen) {
    let x = M;
    for (const t of z) {
      if (t === "♥") { x += (await malen(p2, "herz", x, y - 2, { h: 26 })).w + 9; continue; }
      if (/^[a-z]+$/.test(t) && t.length > 2) { x += (await malen(p2, t, x, y - 8, { w: 38, h: 38 })).w + 9; continue; }
      x += silbenText(p2, t, x, y, 28) + 11;
    }
    y += 46;
  }

  y += 4;
  text(p2, "Fragen (ein Erwachsener liest vor, das Kind kreuzt an):", M, y, 11, { color: grau });
  y += 22;
  for (const f of g.fragen) {
    text(p2, f.frage, M, y, 16, { f: fett });
    let x = M + 150;
    for (const a of f.antworten) {
      p2.drawCircle({ x: x + 8, y: H - y - 9, size: 8, borderColor: tinte, borderWidth: 1 });
      x += 24;
      x += f.art === "bild" ? (await malen(p2, a, x, y - 8, { w: 38, h: 34 })).w + 26 : silbenText(p2, a, x, y - 2, 20) + 26;
    }
    y += 44;
  }

  // Buchstabenkarten
  y += 10;
  strich(p2, M, y, W - M, y, linie);
  y += 14;
  text(p2, "Ausschneiden und Wörter legen:", M, y, 14, { f: fett });
  text(p2, l.bauen.map((x) => x.wort).join(" · "), M + 225, y, 14);
  y += 28;
  const karten = [];
  for (const laut of l.laute) karten.push(laut, laut);
  for (const laut of l.laute) karten.push(laut.toLowerCase(), laut.toLowerCase(), laut.toLowerCase());
  const kw = (W - 2 * M) / 10, kh = 62;
  karten.forEach((k, i) => {
    const x = M + (i % 10) * kw, yy = y + Math.floor(i / 10) * kh;
    rahmen(p2, x, yy, kw, kh, { dick: 0.7, farbe: grau, gestrichelt: true });
    text(p2, k, x + (kw - breite(k, 40)) / 2, yy + 11, 40);
  });
  y += Math.ceil(karten.length / 10) * kh + 14;
  text(p2, "Laute sprechen, nicht Buchstabennamen: „mmm“ statt „em“. Mehr Tipps: lesemappe.janemmel.de/eltern/", M, Math.max(y, H - M - 14), 9, { color: grau });

  return doc.save();
}

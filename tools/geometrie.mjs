// Wo auf der Rutsche die Laute stehen und wie die Kugel rutscht.
// Die Zahlen stammen aus tools/bilder.py (RUTSCHE_BOX, BAHN, Leinwand 1000 × 1000);
// Website und PDF rechnen damit in Prozent des Bildes.
const BOX = [60, 120, 1000, 900];
const BAHN = [[330, 250], [420, 300], [520, 420], [640, 600], [760, 740], [880, 800], [960, 805]];
const START = [310, 205]; // oben auf der Leiter
const ERSTER_LAUT = [255, 165]; // links über der Leiter, wie auf dem Leseblatt

const prozent = ([x, y]) => [((x - BOX[0]) / (BOX[2] - BOX[0])) * 100, ((y - BOX[1]) / (BOX[3] - BOX[1])) * 100];

function laengen(pfad) {
  const d = [0];
  for (let i = 1; i < pfad.length; i++) d.push(d[i - 1] + Math.hypot(pfad[i][0] - pfad[i - 1][0], pfad[i][1] - pfad[i - 1][1]));
  return d;
}

function punktBei(pfad, d, s) {
  const i = Math.max(1, d.findIndex((x) => x >= s));
  const u = (s - d[i - 1]) / (d[i] - d[i - 1] || 1);
  const [a, b] = [pfad[i - 1], pfad[i]];
  const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty) || 1;
  return { p: [a[0] + tx * u, a[1] + ty * u], normal: [ty / n, -tx / n] };
}

/** Für ein Wort: Laute mit Lage (Prozent) und Zeitfenster, Kugelbahn als Prozentpunkte. */
export function rutsche(wort) {
  const buchstaben = [...wort];
  const pfad = [START, ...BAHN];
  const d = laengen(pfad);
  const gesamt = d.at(-1);
  // Kugelbahn gleichmäßig nach Weglänge, damit die Zeit in lesemappe.js der Strecke entspricht
  const kugel = Array.from({ length: 41 }, (_, k) => prozent(punktBei(pfad, d, (gesamt * k) / 40).p));
  const n = buchstaben.length;
  const anteile = buchstaben.map((_, i) => (i === 0 ? 0 : 0.2 + ((i - 1) / Math.max(1, n - 2)) * 0.72));
  const laute = buchstaben.map((zeichen, i) => {
    let lage = ERSTER_LAUT;
    if (i > 0) {
      const { p, normal } = punktBei(pfad, d, anteile[i] * gesamt);
      lage = [p[0] + normal[0] * 78, p[1] + normal[1] * 78];
    }
    const [x, y] = prozent(lage);
    const von = i === 0 ? 0 : anteile[i] - 0.06;
    const bis = i === n - 1 ? 1.01 : anteile[i + 1] - 0.06;
    return { zeichen, x, y, von, bis };
  });
  return { laute, kugel, seitenverhaeltnis: (BOX[2] - BOX[0]) / (BOX[3] - BOX[1]) };
}

/** Silben eines einfachen Wortes (Konsonant-Vokal-Silben, „Lo-la“ geht immer vor). */
export function silben(wort) {
  if (wort.includes("-")) return wort.split("-");
  return wort.match(/[^aeiouäöüAEIOUÄÖÜ]*[aeiouäöüAEIOUÄÖÜ]+(?:[^aeiouäöüAEIOUÄÖÜ]+$)?/g) ?? [wort];
}

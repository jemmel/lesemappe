"""Die Wachsmalbilder der Lesemappe.

Jedes Bild ist aus Strichen gebaut (siehe kreide.py), die Seeds sind fest: ein
neuer Lauf gibt dieselben Bilder. Ausgabe:

* generated/<name>.png  – transparent, groß (Vorlage und PDF)
* generated/_uebersicht.png – Kontaktbogen zum Durchsehen
* generated/klein/<name>.png – höchstens 360 px, für die PDFs
* site/img/<name>.webp  – für die Website, höchstens 480 px

Aufruf:  python tools/bilder.py [name ...]
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

import kreide as k
from kreide import C, S, Paper, _arc, contact_sheet, face, heart_pts, star_pts, write

WEB = k.ROOT / "site" / "img"

# Die Rutsche wird nicht auf den Inhalt zugeschnitten, sondern immer auf diesen
# Ausschnitt: die Website legt die Buchstaben an feste Stellen der Rutschbahn.
RUTSCHE_BOX = (60, 120, 1000, 900)
# Rutschbahn in Leinwand-Koordinaten; site/js/lektion.js rechnet mit denselben Zahlen.
BAHN = [(330, 250), (420, 300), (520, 420), (640, 600), (760, 740), (880, 800), (960, 805)]


def ausschnitt(p: Paper, name, box, long_edge=900):
    """Wie Paper.save, aber mit festem Ausschnitt statt Zuschnitt auf den Inhalt."""
    A = p.A
    col = np.where(A[..., None] > 1e-4, p.P / np.maximum(A, 1e-4)[..., None], 1.0)
    rgba = np.dstack([np.clip(col, 0, 1) * 255, A * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA").crop(box)
    im.thumbnail((long_edge, long_edge), Image.LANCZOS)
    im.save(k.OUT / f"{name}.png", optimize=True)
    return im


# ── Rutsche, Flugzeug, Monster ────────────────────────────────────────────

def rutsche(p):
    # Leiter: zwei Holme, Sprossen
    p.line([(170, 860), (300, 250)], "black", 10)
    p.line([(250, 870), (365, 262)], "black", 10)
    for t in np.linspace(0.12, 0.9, 7):
        a = (170 + (300 - 170) * t, 860 + (250 - 860) * t)
        b = (250 + (365 - 250) * t, 870 + (262 - 870) * t)
        p.line([a, b], "black", 8)
    # Bahn: Oberkante und Unterkante, dazwischen ausgemalt
    oben = np.array(BAHN, float)
    unten = oben + np.array([0, 55])
    unten[-1] += (10, -20)
    flaeche = np.vstack([oben, unten[::-1]])
    p.fill(p.poly_mask(flaeche), "orange", angle=35, spacing=11, width=14, pressure=0.65)
    p.curve(oben, "black", 10, wob=1.2)
    p.curve(unten, "black", 10, wob=1.2)
    p.line([unten[-1], oben[-1]], "black", 9)
    # Stütze unter der Bahn
    p.line([(640, 665), (650, 880)], "black", 9)
    p.line([(520, 485), (520, 880)], "black", 9)


def flugzeug(p):
    rumpf = [(150, 520), (260, 450), (720, 440), (860, 470), (900, 510), (860, 550), (260, 570)]
    p.fill(p.poly_mask(rumpf), "lightblue", spacing=12, width=15, pressure=0.6)
    p.line(rumpf + [rumpf[0]], "blue", 11)
    p.line([(470, 470), (380, 270), (450, 270), (600, 460)], "blue", 10)
    p.line([(470, 560), (400, 720), (470, 720), (600, 560)], "blue", 10)
    p.line([(220, 480), (160, 360), (220, 360), (300, 455)], "blue", 10)
    for x in range(330, 700, 70):
        p.circle(x, 500, 18, color="blue", width=6)
    p.fill(p.poly_mask([(800, 470), (860, 475), (880, 505), (800, 500)]), "blue", spacing=6, width=8, overshoot=3)
    for i, y in enumerate((470, 520, 570)):
        p.line([(110 - i * 15, y), (20 - i * 15, y + p.rng.uniform(-6, 6))], "grey", 8, 0.7)


def monster(p):
    """Mo, das Lesemonster: grün, zottelig, mit Buch."""
    a = np.linspace(0, 2 * np.pi, 140)
    r = 1 + 0.06 * np.sin(9 * a)
    body = np.c_[500 + 230 * r * np.cos(a), 520 + 270 * r * np.sin(a)]
    p.fill(p.poly_mask(body), "green", spacing=12, width=16, pressure=0.7)
    p.stroke(body, C["green"], 11, 0.95, wob=1.5, smooth=False)
    # Hörner
    p.fill(p.poly_mask([(360, 320), (300, 160), (420, 290)]), "purple", spacing=8, width=11)
    p.fill(p.poly_mask([(580, 290), (690, 150), (640, 320)]), "purple", spacing=8, width=11)
    # Augen
    for ex in (420, 580):
        p.fill(p.ellipse_mask(ex, 390, 52, 56), "lightblue", spacing=6, width=9, pressure=0.25)
        p.circle(ex, 390, 54, 58, color="black", width=8)
        p.dot(ex + 8, 402, 16)
    p.curve(_arc(500, 470, 90, 50, 20, 160, 10), "black", 9)
    p.line([(470, 512), (478, 540), (490, 514)], "black", 6)
    # Buch
    buch = [(330, 600), (500, 640), (670, 600), (670, 800), (500, 840), (330, 800)]
    p.fill(p.poly_mask(buch), "red", spacing=11, width=14, pressure=0.8)
    p.line(buch + [buch[0]], "red", 10)
    p.line([(500, 640), (500, 840)], "black", 8)
    for y in (680, 720, 760):
        p.line([(370, y), (460, y + 15)], "black", 5, 0.6)
        p.line([(540, y + 15), (630, y)], "black", 5, 0.6)
    # Hände am Buch, Füße
    p.circle(320, 700, 30, color="green", width=10)
    p.circle(680, 700, 30, color="green", width=10)
    p.line([(420, 785), (400, 880), (350, 885)], "green", 14)
    p.line([(580, 785), (600, 880), (650, 885)], "green", 14)


# ── Leckereien (wie auf dem Leseblatt) ────────────────────────────────────

def kirsche(p):
    for x, y in [(380, 650), (610, 680)]:
        p.fill(p.ellipse_mask(x, y, 120, 115), "red", spacing=11, width=16, pressure=0.85)
        p.circle(x, y, 122, 117, color="red", width=10)
        p.curve(_arc(x - 40, y - 40, 40, 30, 200, 280, 6), "pink", 9, 0.6)
    p.curve([(390, 535), (440, 380), (520, 220)], "brown", 11)
    p.curve([(610, 565), (580, 380), (520, 220)], "brown", 11)
    blatt = [(520, 220), (610, 150), (720, 170), (640, 240)]
    p.fill(p.poly_mask(blatt), "green", spacing=9, width=12)
    p.line(blatt + [blatt[0]], "green", 8)


def kaese(p):
    vorne = [(200, 470), (800, 470), (800, 760), (200, 760)]
    oben = [(200, 470), (540, 250), (800, 470)]
    p.fill(p.poly_mask(vorne), "yellow", spacing=11, width=16, pressure=0.8)
    p.fill(p.poly_mask(oben), "yellow", angle=10, spacing=11, width=16, pressure=0.6)
    p.line(vorne + [vorne[0]], "orange", 10)
    p.line(oben, "orange", 10)
    for x, y, r in [(300, 560, 40), (480, 650, 55), (650, 560, 35), (700, 690, 30), (380, 700, 25), (560, 380, 30)]:
        p.fill(p.ellipse_mask(x, y, r, r * 0.85), "orange", spacing=7, width=10, pressure=0.7, overshoot=3)
        p.circle(x, y, r, r * 0.85, color="orange", width=6)


def kuchen(p):
    # Gugelhupf mit Zuckerguss
    form = [(220, 800), (180, 520), (300, 400), (700, 400), (820, 520), (780, 800)]
    p.fill(p.poly_mask(form), "brown", angle=80, spacing=12, width=15, pressure=0.6)
    for x in range(260, 760, 80):
        p.line([(x, 470), (x + 10, 790)], "brown", 9)
    p.line(form + [form[0]], "brown", 11)
    guss = [(180, 520), (300, 390), (700, 390), (820, 520), (760, 560), (720, 500), (660, 590),
            (600, 500), (520, 570), (450, 500), (380, 600), (320, 510), (240, 580)]
    p.fill(p.poly_mask(guss), "pink", spacing=10, width=14, pressure=0.7)
    p.stroke(guss, C["pink"], 9, 0.9, wob=1.2, smooth=True, closed=True)
    p.fill(p.ellipse_mask(500, 395, 70, 26), "lightblue", spacing=6, width=8, pressure=0.4)
    p.circle(500, 395, 72, 28, color="grey", width=6)
    for x, y, col in [(300, 450, "yellow"), (420, 430, "blue"), (560, 445, "green"), (680, 450, "red"), (360, 520, "purple")]:
        p.line([(x, y), (x + 20, y - 8)], col, 9)


def marmelade(p):
    glas = [(270, 360), (730, 360), (760, 450), (760, 820), (240, 820), (240, 450)]
    p.fill(p.poly_mask([(255, 480), (745, 480), (745, 810), (255, 810)]), "red", spacing=11, width=15, pressure=0.75)
    p.line(glas + [glas[0]], "grey", 10)
    deckel = [(250, 250), (750, 250), (750, 360), (250, 360)]
    p.fill(p.poly_mask(deckel), "red", angle=0, spacing=10, width=14, pressure=0.5)
    p.line(deckel + [deckel[0]], "red", 10)
    for x in range(290, 740, 50):
        p.line([(x, 265), (x, 345)], "red", 6, 0.6)
    etikett = [(330, 560), (670, 560), (670, 720), (330, 720)]
    p.fill(p.poly_mask(etikett), "yellow", spacing=9, width=12, pressure=0.4, overshoot=3)
    p.line(etikett + [etikett[0]], "orange", 7)
    for x, y in [(450, 640), (550, 640)]:
        p.fill(p.ellipse_mask(x, y, 30, 28), "red", spacing=6, width=9, overshoot=2)


def eis(p):
    tuete = [(380, 480), (620, 480), (510, 900)]
    p.fill(p.poly_mask(tuete), "orange", spacing=10, width=14, pressure=0.6)
    p.line(tuete + [tuete[0]], "brown", 10)
    for t in (0.25, 0.5, 0.75):
        p.line([(380 + 130 * t * 2 if t < 0.5 else 380, 480), (510, 900 - 400 * (1 - t))], "brown", 6, 0.6)
    for x, y, col in [(430, 420, "pink"), (575, 410, "brown"), (505, 270, "yellow")]:
        p.fill(p.ellipse_mask(x, y, 115, 100), col, spacing=11, width=15, pressure=0.75)
        p.circle(x, y, 117, 102, color=col if col != "yellow" else "orange", width=9)
    p.fill(p.ellipse_mask(505, 150, 28, 28), "red", spacing=6, width=10, overshoot=3)
    p.curve([(505, 125), (530, 70), (560, 50)], "green", 7)


def pommes(p):
    tuete = [(250, 450), (750, 450), (690, 860), (310, 860)]
    for i, x in enumerate(range(290, 720, 55)):
        h = 160 + 90 * math.sin(i * 1.7) + p.rng.uniform(-30, 30)
        rot = p.rng.uniform(-10, 10)
        p.fill(p.poly_mask([(x, 470), (x + 34, 470), (x + 34 + rot, 470 - h), (x + rot, 470 - h)]),
               "yellow", angle=85, spacing=7, width=10, overshoot=3)
        p.line([(x, 470), (x + rot, 470 - h), (x + 34 + rot, 470 - h), (x + 34, 470)], "orange", 6)
    p.fill(p.poly_mask(tuete), "red", spacing=12, width=16, pressure=0.85)
    p.line(tuete + [tuete[0]], "red", 10)
    p.curve(_arc(500, 610, 90, 70, 20, 160, 10), "yellow", 12)


def schokolade(p):
    tafel = [(260, 180), (740, 180), (740, 860), (260, 860)]
    p.fill(p.poly_mask(tafel), "brown", spacing=11, width=16, pressure=0.85)
    for y in (350, 520, 690):
        p.line([(270, y), (730, y)], "black", 6, 0.5)
    p.line([(500, 190), (500, 850)], "black", 6, 0.5)
    papier = [(240, 520), (760, 520), (760, 880), (240, 880)]
    p.fill(p.poly_mask(papier), "purple", angle=0, spacing=11, width=15, pressure=0.8)
    p.line(tafel + [tafel[0]], "black", 9)
    p.line([(240, 520), (760, 520)], "purple", 9)
    p.line([(330, 680), (670, 700)], "lightblue", 10, 0.7)


# ── Leute (und ein Lama) ──────────────────────────────────────────────────

def figur(p, haar_hinten=None, haare=None, kleid="pink", brille=False, dutt=False, zoepfe=False,
          kopf=(500, 260), r=95):
    hx, hy = kopf
    if haar_hinten:
        for s in (-1, 1):
            strähne = [(hx + s * (r - 20), hy - 40), (hx + s * (r + 30), hy - 40),
                       (hx + s * (r + 50), hy + 220), (hx + s * (r - 10), hy + 210)]
            p.fill(p.poly_mask(strähne), haar_hinten, angle=85, spacing=9, width=12, pressure=0.8)
    p.fill(p.ellipse_mask(hx, hy, r, r * 1.05), "pink", spacing=12, width=14, pressure=0.22)
    p.circle(hx, hy, r, r * 1.05, color="black", width=9)
    face(p, hx, hy + 10, r * 0.9)
    if haare:
        mutze = [(hx - r - 8, hy - 10), (hx - r * 0.6, hy - r - 10), (hx + r * 0.6, hy - r - 12), (hx + r + 8, hy - 10),
                 (hx + r * 0.5, hy - r * 0.55), (hx - r * 0.5, hy - r * 0.6)]
        p.fill(p.poly_mask(mutze), haare, spacing=8, width=12, pressure=0.85)
    if dutt:
        p.fill(p.ellipse_mask(hx, hy - r - 50, 55, 45), haare or "grey", spacing=7, width=11)
        p.circle(hx, hy - r - 50, 56, 46, color="grey", width=7)
    if zoepfe:
        for s in (-1, 1):
            p.fill(p.ellipse_mask(hx + s * (r + 55), hy + 10, 40, 60), haare, spacing=7, width=11)
            p.line([(hx + s * (r + 10), hy - 20), (hx + s * (r + 35), hy - 30)], "red", 10)
    if brille:
        for s in (-1, 1):
            p.circle(hx + s * r * 0.33, hy - 4, r * 0.25, color="black", width=6)
        p.line([(hx - r * 0.1, hy - 6), (hx + r * 0.1, hy - 6)], "black", 5)
    hals = hy + r * 1.05
    rock = [(hx - 70, hals + 10), (hx + 70, hals + 10), (hx + 190, hals + 430), (hx - 190, hals + 430)]
    p.fill(p.poly_mask(rock), kleid, spacing=11, width=15, pressure=0.8)
    p.line(rock + [rock[0]], kleid, 9)
    p.line([(hx - 70, hals + 40), (hx - 180, hals + 220)], "black", 9)
    p.line([(hx + 70, hals + 40), (hx + 180, hals + 220)], "black", 9)
    for s in (-1, 1):
        p.line([(hx + s * 60, hals + 430), (hx + s * 70, hals + 560)], "black", 9)
        p.line([(hx + s * 70, hals + 560), (hx + s * 70 + s * 40, hals + 562)], "black", 11)


def lola(p):
    figur(p, haare="orange", zoepfe=True, kleid="yellow", kopf=(500, 300), r=90)


def mama(p):
    figur(p, haar_hinten="brown", haare="brown", kleid="red", kopf=(500, 230), r=88)


def oma(p):
    figur(p, haare="grey", dutt=True, brille=True, kleid="purple", kopf=(500, 270), r=88)


def lama(p):
    koerper = (430, 560, 220, 130)
    p.fill(p.ellipse_mask(*koerper), "yellow", spacing=12, width=16, pressure=0.35)
    p.loops(430, 560, 200, "orange", turns=5, width=10, pressure=0.6, drift=0.1, squash=0.6)
    p.circle(430, 560, 225, 135, color="brown", width=10)
    hals = [(560, 470), (640, 470), (680, 200), (600, 200)]
    p.fill(p.poly_mask(hals), "yellow", angle=80, spacing=10, width=14, pressure=0.35)
    p.line([(560, 470), (600, 220)], "brown", 10)
    p.line([(645, 470), (690, 230)], "brown", 10)
    p.fill(p.ellipse_mask(670, 190, 85, 60), "yellow", spacing=9, width=13, pressure=0.4)
    p.circle(670, 190, 88, 62, color="brown", width=9)
    p.line([(620, 145), (600, 60), (650, 130)], "brown", 9)
    p.line([(690, 140), (700, 55), (725, 140)], "brown", 9)
    p.dot(680, 175, 11)
    p.curve(_arc(735, 215, 22, 15, 20, 160, 6), "black", 6)
    for x in (300, 370, 500, 570):
        p.line([(x, 660), (x + p.rng.uniform(-10, 10), 860)], "brown", 12)
    p.curve([(215, 520), (170, 480), (190, 430)], "brown", 12)
    # Decke
    decke = [(380, 430), (520, 440), (510, 560), (390, 560)]
    p.fill(p.poly_mask(decke), "red", spacing=9, width=12)
    for x in range(395, 510, 30):
        p.line([(x, 560), (x, 590)], "blue", 7)


# ── Belohnung und Schmuck ─────────────────────────────────────────────────

def herz(p):
    pts = heart_pts(500, 470, 21)
    p.fill(p.poly_mask(pts), "red", spacing=11, width=16, pressure=0.85)
    p.stroke(pts, C["red"], 11, 0.95, wob=2, smooth=False)


def herz_leer(p):
    p.stroke(heart_pts(500, 470, 21), C["grey"], 9, 0.85, wob=2, smooth=False)


def stern(p):
    pts = star_pts(500, 480, 290, 125, -90 + p.rng.uniform(-8, 8))
    p.fill(p.poly_mask(pts), "yellow", spacing=11, width=16)
    p.line(pts + [pts[0]], "orange", 11, 0.9, wob=2)


def stern_leer(p):
    pts = star_pts(500, 480, 290, 125, -90)
    p.line(pts + [pts[0]], "grey", 9, 0.8, wob=2)


def sonne(p):
    p.fill(p.ellipse_mask(500, 500, 165, 160), "yellow", spacing=11, width=16, pressure=0.85)
    p.circle(500, 500, 170, 165, color="orange", width=11)
    for i in range(13):
        a = math.radians(i * 360 / 13 + p.rng.uniform(-6, 6))
        r0, r1 = 205, 205 + p.rng.uniform(90, 175)
        p.line([(500 + r0 * math.cos(a), 500 + r0 * math.sin(a)),
                (500 + r1 * math.cos(a), 500 + r1 * math.sin(a))], "yellow", 14, 0.9, wob=3)
    face(p, 500, 505, 120)


def buch(p):
    links = [(140, 300), (480, 360), (480, 800), (140, 740)]
    rechts = [(520, 360), (860, 300), (860, 740), (520, 800)]
    p.fill(p.poly_mask(links), "lightblue", spacing=12, width=15, pressure=0.35)
    p.fill(p.poly_mask(rechts), "lightblue", spacing=12, width=15, pressure=0.35)
    p.line(links + [links[0]], "blue", 10)
    p.line(rechts + [rechts[0]], "blue", 10)
    for i in range(5):
        y = 420 + i * 60
        p.line([(190, y - 40 + i * 4), (430, y + 4)], "grey", 6, 0.6)
        p.line([(570, y + 4), (810, y - 40 + i * 4)], "grey", 6, 0.6)
    for x, y, r in [(500, 200, 30), (380, 160, 20), (630, 150, 24)]:
        pts = star_pts(x, y, r * 1.6, r * 0.7)
        p.fill(p.poly_mask(pts), "yellow", spacing=6, width=9, overshoot=3)


def schrift_lesemappe(p):
    write(p, "LESEMAPPE", 70, 500, 150, "black", 11)


def schrift_super(p):
    write(p, "SUPER!", 140, 500, 190, "red", 13)


BILDER = {
    "rutsche": (rutsche, RUTSCHE_BOX),
    "flugzeug": (flugzeug, None),
    "monster": (monster, None),
    "kirsche": (kirsche, None),
    "kaese": (kaese, None),
    "kuchen": (kuchen, None),
    "marmelade": (marmelade, None),
    "eis": (eis, None),
    "pommes": (pommes, None),
    "schokolade": (schokolade, None),
    "lola": (lola, None),
    "mama": (mama, None),
    "oma": (oma, None),
    "lama": (lama, None),
    "herz": (herz, None),
    "herz-leer": (herz_leer, None),
    "stern": (stern, None),
    "stern-leer": (stern_leer, None),
    "sonne": (sonne, None),
    "buch": (buch, None),
    "schrift-lesemappe": (schrift_lesemappe, None),
    "schrift-super": (schrift_super, None),
}


def main(nur=None):
    k.OUT.mkdir(exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    (k.OUT / "klein").mkdir(exist_ok=True)
    fertig = []
    for seed, (name, (zeichne, box)) in enumerate(BILDER.items(), start=101):
        if nur and name not in nur:
            continue
        p = Paper(seed)
        zeichne(p)
        im = ausschnitt(p, name, box) if box else p.save(name)
        web = im.copy()
        web.thumbnail((480, 480), Image.LANCZOS)
        web.save(WEB / f"{name}.webp", "WEBP", quality=80, method=6)
        klein = im.copy()
        klein.thumbnail((360, 360), Image.LANCZOS)
        klein.save(k.OUT / "klein" / f"{name}.png", optimize=True)
        fertig.append((name, im))
        print(f"{name:20} {im.size}")
    if not nur:
        contact_sheet(fertig)


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or None)

"""Wachsmalstift auf Papier: die Grundlage für alle Zeichnungen der Lesemappe.

Übernommen aus kitaweb/tools/generate_drawings.py (Sportkita-Website). Nichts ist
abgepaust: jedes Bild entsteht aus Strichen. Ein Strich ist ein wackliger Pfad
(Zittern der Hand plus langsames Abdriften), mit wechselndem Druck gezogen; das
Wachs haftet nur, wo die Papierkörnung hoch genug ist. Flächen werden so
ausgemalt wie von Kindern: ein Zickzack, der über den Rand hinausgeht.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "generated"
HAND = 1.9  # how much a line drifts off its intended path
S = 1000  # drawing canvas; pictures are cropped to their content afterwards

# crayon box, sampled by eye from the template drawings
C = {
    "red": (214, 48, 42),
    "orange": (238, 136, 38),
    "yellow": (240, 210, 0),
    "green": (58, 152, 60),
    "blue": (38, 138, 208),
    "lightblue": (118, 186, 232),
    "purple": (136, 118, 198),
    "pink": (232, 128, 168),
    "brown": (138, 88, 48),
    "black": (34, 34, 38),
    "grey": (120, 120, 124),
}


# ── geometry helpers ──────────────────────────────────────────────────────

def catmull(pts, closed=False, per=14):
    P = np.asarray(pts, float)
    if len(P) < 3:
        return P
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (p2 - p0) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (3 * p1 - p0 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


def resample(P, step=2.5):
    P = np.asarray(P, float)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    if d[-1] < step:
        return P
    s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]


def heart_pts(cx, cy, s):
    t = np.linspace(0, 2 * np.pi, 80)
    x = 16 * np.sin(t) ** 3
    y = -(13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t))
    return np.c_[cx + x * s, cy + y * s]


def star_pts(cx, cy, r_out, r_in, rot=-90):
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ── the paper and the crayon ──────────────────────────────────────────────

class Paper:
    def __init__(self, seed: int):
        self.rng = np.random.default_rng(seed)
        self.P = np.zeros((S, S, 3), np.float32)  # premultiplied colour
        self.A = np.zeros((S, S), np.float32)
        self.grain = self._grain()

    def _grain(self):
        def field(sigma):
            n = (self.rng.random((S, S)) * 255).astype(np.uint8)
            a = np.asarray(Image.fromarray(n).filter(ImageFilter.GaussianBlur(sigma)), np.float32)
            return (a - a.mean()) / (a.std() + 1e-6)
        streak = Image.fromarray((self.rng.random((S, S)) * 255).astype(np.uint8))
        streak = streak.resize((S // 6, S), Image.BILINEAR).resize((S, S), Image.BICUBIC)
        streak = np.asarray(streak.filter(ImageFilter.GaussianBlur(0.8)), np.float32)
        streak = (streak - streak.mean()) / (streak.std() + 1e-6)
        g = 0.45 * field(0.7) + 0.3 * field(2.4) + 0.25 * streak
        # rank-normalise: a pressure of p then covers about p of the paper
        ranks = g.ravel().argsort().argsort()
        return (ranks / ranks.size).reshape(S, S).astype(np.float32)

    def noise(self, n, scales, amp=1.0):
        s = np.arange(n)
        out = np.zeros(n)
        for lam in scales:
            out += np.sin(2 * np.pi * s / (lam * self.rng.uniform(0.7, 1.3))
                          + self.rng.uniform(0, 2 * np.pi)) * self.rng.uniform(0.5, 1)
        return out / len(scales) * amp

    def wobble(self, P, amp):
        if len(P) < 3 or amp <= 0:
            return P
        tang = np.gradient(P, axis=0)
        tang /= np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9
        normal = np.c_[-tang[:, 1], tang[:, 0]]
        off = HAND * amp * self.noise(len(P), (50, 140, 380)) + 0.6 * self.noise(len(P), (5, 9))
        return P + normal * off[:, None]

    # a single crayon stroke
    def stroke(self, pts, color, width=13, pressure=0.8, wob=2.0,
               smooth=True, closed=False, clip=None, tooth=1.0):
        P = catmull(pts, closed) if smooth else np.asarray(pts, float)
        P = self.wobble(resample(P), wob)
        if len(P) < 2:
            return
        n = len(P)
        pv = np.clip(pressure * (0.88 + 0.12 * self.noise(n, (30, 90)) * 2), 0.05, 1)
        wv = width * (0.8 + 0.2 * self.noise(n, (40, 120)) * 2)
        m = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(m)
        seg = 10
        for i in range(0, n - 1, seg):
            chunk = [tuple(p) for p in P[i:i + seg + 1]]
            v, w = int(255 * pv[i]), max(1, int(round(wv[i])))
            d.line(chunk, fill=v, width=w, joint="curve")
            x, y = chunk[0]
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=v)
        x, y = P[-1]
        w = wv[-1]
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=int(255 * pv[-1]))
        mask = np.asarray(m.filter(ImageFilter.GaussianBlur(1.1)), np.float32) / 255
        if clip is not None:
            mask = mask * clip
        self.deposit(mask, color, tooth)

    def deposit(self, mask, color, tooth=1.0):
        dep = np.clip((mask - (1 - self.grain) * tooth) / 0.2, 0, 1) * np.clip(mask * 5, 0, 1)
        dep *= 0.96
        c = np.asarray(color, np.float32) / 255
        self.P = c * dep[..., None] + self.P * (1 - dep[..., None])
        self.A = dep + self.A * (1 - dep)

    # shapes ------------------------------------------------------------
    def ellipse_path(self, cx, cy, rx, ry, rot=0.0, start=None, sweep=None, irregular=0.05):
        start = self.rng.uniform(0, 2 * np.pi) if start is None else start
        sweep = 2 * np.pi * self.rng.uniform(1.04, 1.14) if sweep is None else sweep
        n = max(24, int(abs(sweep) * max(rx, ry) / 6))
        a = np.linspace(start, start + sweep, n)
        r = 1 + irregular * self.noise(n, (n / 2, n / 5))
        x, y = rx * r * np.cos(a), ry * r * np.sin(a)
        cr, sr = math.cos(rot), math.sin(rot)
        return np.c_[cx + x * cr - y * sr, cy + x * sr + y * cr]

    def circle(self, cx, cy, rx, ry=None, color="black", width=10, pressure=0.85, **kw):
        ry = rx if ry is None else ry
        self.stroke(self.ellipse_path(cx, cy, rx, ry, **kw), C[color], width, pressure,
                    wob=1.2, smooth=False)

    def line(self, pts, color="black", width=10, pressure=0.85, wob=1.5, smooth=False):
        self.stroke(pts, C[color], width, pressure, wob=wob, smooth=smooth)

    def curve(self, pts, color="black", width=10, pressure=0.85, wob=1.5):
        self.stroke(pts, C[color], width, pressure, wob=wob, smooth=True)

    def loops(self, cx, cy, r, color, turns=7, width=14, pressure=0.85, drift=0.25, squash=1.0):
        n = int(turns * 40)
        a = np.linspace(0, turns * 2 * np.pi, n) + self.rng.uniform(0, 6)
        rr = r * (0.45 + 0.55 * (self.noise(n, (37, 71, 13)) * 0.5 + 0.5))
        walk = np.cumsum(self.rng.normal(0, 1, (n, 2)), axis=0)
        walk = walk / (np.abs(walk).max() + 1e-6) * r * drift
        pts = np.c_[cx + rr * np.cos(a) + walk[:, 0], cy + rr * squash * np.sin(a) + walk[:, 1]]
        self.stroke(pts, C[color], width, pressure, wob=1.0, smooth=False)

    def dot(self, x, y, r=10, color="black"):
        self.loops(x, y, r, color, turns=3, width=max(6, r), drift=0.1)

    # masks and fills ---------------------------------------------------
    @staticmethod
    def poly_mask(pts):
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).polygon([tuple(p) for p in np.asarray(pts)], fill=255)
        return np.asarray(m, np.float32) / 255

    @staticmethod
    def ellipse_mask(cx, cy, rx, ry):
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        return np.asarray(m, np.float32) / 255

    def fill(self, mask, color, angle=None, spacing=12, width=15, pressure=0.75, overshoot=10):
        spacing *= 1.25
        pressure *= 0.92
        """Zigzag scribble over a region, the way a child colours in."""
        angle = self.rng.uniform(-35, 35) if angle is None else angle
        ys, xs = np.nonzero(mask > 0.5)
        if len(xs) == 0:
            return
        c = np.array([xs.mean(), ys.mean()])
        R = np.hypot(xs - c[0], ys - c[1]).max() + 4
        a = math.radians(angle)
        dv, nv = np.array([math.cos(a), math.sin(a)]), np.array([-math.sin(a), math.cos(a)])
        ts = np.arange(-R, R, 2.0)
        pts, flip = [], False
        for off in np.arange(-R, R, spacing):
            q = c + nv * off + dv * ts[:, None]
            qi = np.round(q).astype(int)
            ok = (qi[:, 0] >= 0) & (qi[:, 0] < S) & (qi[:, 1] >= 0) & (qi[:, 1] < S)
            inside = np.zeros(len(ts), bool)
            inside[ok] = mask[qi[ok, 1], qi[ok, 0]] > 0.5
            if not inside.any():
                continue
            idx = np.nonzero(inside)[0]
            t0 = ts[idx[0]] - self.rng.uniform(-overshoot * 0.6, overshoot)
            t1 = ts[idx[-1]] + self.rng.uniform(-overshoot * 0.6, overshoot)
            p0, p1 = c + nv * off + dv * t0, c + nv * off + dv * t1
            pts += [p1, p0] if flip else [p0, p1]
            flip = not flip
        if len(pts) < 2:
            return
        grow = int(overshoot) | 1
        clip = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow))
        clip = np.asarray(clip.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        self.stroke(pts, C[color], width, pressure, wob=1.2, smooth=False, clip=clip)

    # output ------------------------------------------------------------
    def save(self, name: str, long_edge=900, margin=24):
        A = self.A
        ys, xs = np.nonzero(A > 0.03)
        x0, x1 = max(0, xs.min() - margin), min(S, xs.max() + margin)
        y0, y1 = max(0, ys.min() - margin), min(S, ys.max() + margin)
        col = np.where(A[..., None] > 1e-4, self.P / np.maximum(A, 1e-4)[..., None], 1.0)
        rgba = np.dstack([np.clip(col, 0, 1) * 255, A * 255]).astype(np.uint8)
        im = Image.fromarray(rgba, "RGBA").crop((x0, y0, x1, y1))
        im.thumbnail((long_edge, long_edge), Image.LANCZOS)
        im.save(OUT / f"{name}.png", optimize=True)
        return im


# ── children's lettering ──────────────────────────────────────────────────
# Strokes in a unit box (x right, y down). Curved letters are smoothed.

def _arc(cx, cy, rx, ry, a0, a1, n=16):
    a = np.radians(np.linspace(a0, a1, n))
    return list(zip(cx + rx * np.cos(a), cy + ry * np.sin(a)))


LETTERS = {
    "A": (0.8, False, [[(0, 1), (0.4, 0), (0.8, 1)], [(0.16, 0.62), (0.66, 0.62)]]),
    "B": (0.7, True, [[(0, 0), (0, 1)], [(0, 0), (0.45, 0), (0.62, 0.12), (0.6, 0.36), (0.4, 0.47), (0, 0.47)],
                      [(0, 0.47), (0.5, 0.48), (0.7, 0.62), (0.68, 0.88), (0.45, 1), (0, 1)]]),
    "C": (0.75, True, [_arc(0.42, 0.5, 0.4, 0.5, -40, -320)]),
    "D": (0.75, True, [[(0, 0), (0, 1)], [(0, 0), (0.4, 0.02), (0.7, 0.25), (0.72, 0.72), (0.4, 0.98), (0, 1)]]),
    "E": (0.62, False, [[(0.62, 0), (0, 0), (0, 1), (0.62, 1)], [(0, 0.5), (0.48, 0.5)]]),
    "F": (0.6, False, [[(0.6, 0), (0, 0), (0, 1)], [(0, 0.5), (0.45, 0.5)]]),
    "G": (0.8, True, [_arc(0.42, 0.5, 0.4, 0.5, -40, -330), [(0.5, 0.58), (0.82, 0.58), (0.8, 0.9)]]),
    "H": (0.72, False, [[(0, 0), (0, 1)], [(0.72, 0), (0.72, 1)], [(0, 0.5), (0.72, 0.5)]]),
    "I": (0.12, False, [[(0.06, 0), (0.06, 1)]]),
    "K": (0.7, False, [[(0, 0), (0, 1)], [(0.66, 0), (0, 0.56)], [(0.2, 0.42), (0.7, 1)]]),
    "L": (0.55, False, [[(0, 0), (0, 1), (0.55, 1)]]),
    "M": (0.9, False, [[(0, 1), (0.04, 0), (0.45, 0.62), (0.86, 0), (0.9, 1)]]),
    "N": (0.75, False, [[(0, 1), (0, 0), (0.75, 1), (0.75, 0)]]),
    "O": (0.85, True, [_arc(0.42, 0.5, 0.42, 0.5, -90, 290, 24)]),
    "P": (0.62, True, [[(0, 1), (0, 0)], [(0, 0), (0.42, 0), (0.62, 0.14), (0.6, 0.38), (0.4, 0.52), (0, 0.52)]]),
    "R": (0.68, True, [[(0, 1), (0, 0)], [(0, 0), (0.42, 0), (0.62, 0.14), (0.6, 0.38), (0.4, 0.52), (0, 0.52)],
                       [(0.22, 0.52), (0.4, 0.7), (0.68, 1)]]),
    "S": (0.62, True, [[(0.6, 0.1), (0.38, 0), (0.1, 0.05), (0.02, 0.24), (0.2, 0.44), (0.5, 0.54),
                        (0.64, 0.76), (0.52, 0.96), (0.24, 1), (0, 0.88)]]),
    "T": (0.72, False, [[(0, 0), (0.72, 0)], [(0.36, 0), (0.36, 1)]]),
    "U": (0.72, True, [[(0, 0), (0, 0.68), (0.14, 0.94), (0.36, 1), (0.58, 0.94), (0.72, 0.68), (0.72, 0)]]),
    "W": (1.0, False, [[(0, 0), (0.22, 1), (0.5, 0.34), (0.78, 1), (1.0, 0)]]),
    "Z": (0.66, False, [[(0, 0), (0.66, 0), (0, 1), (0.66, 1)]]),
    "!": (0.12, False, [[(0.06, 0), (0.06, 0.66)]]),
    " ": (0.45, False, []),
}


MAX_X = 960


def write(p: Paper, text, x, y, h, color="black", width=9, gap=0.42, mirror="", wild=1.0):
    """Write capitals like a five-year-old: uneven size, tilt and spacing.

    Returns the bounding box (x0, y0, x1, y1) of what was written.
    """
    boxes = []
    nominal = sum(LETTERS[ch][0] + gap for ch in text) - gap
    h = min(h, (MAX_X - x) / (nominal * (1 + 0.14 * wild)))
    for ch in text:
        w, smooth, strokes = LETTERS[ch]
        sc = h * p.rng.uniform(1 - 0.18 * wild, 1 + 0.14 * wild)
        rot = math.radians(p.rng.uniform(-11, 11) * wild)
        yo = y + p.rng.uniform(-0.1, 0.1) * h * wild
        flip = ch in mirror
        for st in strokes:
            pts = []
            for ux, uy in st:
                if flip:
                    ux = w - ux
                dx, dy = ux * sc, (uy - 0.5) * sc
                pts.append((x + dx * math.cos(rot) - dy * math.sin(rot),
                            yo + dx * math.sin(rot) + dy * math.cos(rot)))
            p.stroke(pts, C[color], width, 0.9, wob=1.6, smooth=smooth)
        if ch == "!":
            p.dot(x + 0.06 * sc, yo + 0.45 * sc, r=width * 0.7, color=color)
        if strokes:
            boxes.append((x, yo - sc / 2, x + w * sc, yo + sc / 2))
        x += (w + gap) * sc
    xs0, ys0, xs1, ys1 = zip(*boxes)
    return min(xs0), min(ys0), max(xs1), max(ys1)


# ── building blocks ───────────────────────────────────────────────────────

def face(p, cx, cy, r, color="black"):
    p.dot(cx - r * 0.35, cy - r * 0.15, r * 0.1, color)
    p.dot(cx + r * 0.35, cy - r * 0.15, r * 0.1, color)
    p.curve(_arc(cx, cy + r * 0.05, r * 0.45, r * 0.4, 25, 155, 10), color, max(6, r * 0.09))


def grass(p, y, x0=120, x1=880, color="green"):
    xs = np.arange(x0, x1, 26)
    pts = []
    for i, x in enumerate(xs):
        pts += [(x, y + p.rng.uniform(-4, 4)), (x + 13, y - p.rng.uniform(22, 42))]
    p.line(pts, color, 9, 0.8, wob=1.0)


def speed_lines(p, x, y, n=3, length=110, color="blue"):
    for i in range(n):
        yy = y + i * 42
        xx = x + p.rng.uniform(-20, 20)
        p.line([(xx, yy), (xx - length * p.rng.uniform(0.7, 1.1), yy + p.rng.uniform(-8, 8))], color, 9, 0.8)


def stick_kid(p, head, body_end, arms, legs, color="black", head_r=58, hair=None, shirt=None, dress=None):
    hx, hy = head
    p.circle(hx, hy, head_r, color=color, width=9)
    face(p, hx, hy, head_r)
    if hair:
        for k in range(7):
            a = math.radians(-160 + k * 23)
            x0, y0 = hx + head_r * math.cos(a), hy + head_r * math.sin(a)
            p.line([(x0, y0), (x0 + 26 * math.cos(a), y0 + 26 * math.sin(a))], hair, 8)
    neck = (hx, hy + head_r)
    if dress:
        tri = [(neck[0] - 12, neck[1] + 8), (neck[0] + 12, neck[1] + 8),
               (body_end[0] + 95, body_end[1]), (body_end[0] - 95, body_end[1])]
        p.fill(p.poly_mask(tri), dress, spacing=11, width=13)
        p.line(tri + [tri[0]], dress, 8, 0.9)
    else:
        p.line([neck, body_end], color, 9)
    if shirt:
        sx, sy = neck
        bx, by = body_end
        mid = ((sx + bx) / 2, (sy + by) / 2)
        box = [(sx - 42, sy + 6), (sx + 42, sy + 6), (mid[0] + 44, mid[1] + 30), (mid[0] - 44, mid[1] + 30)]
        p.fill(p.poly_mask(box), shirt, spacing=10, width=13, pressure=0.7)
    for arm in arms:
        p.line(arm, color, 9)
        hx2, hy2 = arm[-1]
        p.loops(hx2, hy2, 9, color, turns=2, width=7)
    for leg in legs:
        p.line(leg, color, 9)
        fx, fy = leg[-1]
        p.line([(fx - 4, fy), (fx + 26, fy + 2)], color, 10)



def contact_sheet(images, cols=5, cell=300, pad=16):
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGBA", (cols * cell, rows * (cell + 26)), (255, 255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(images):
        t = im.copy()
        t.thumbnail((cell - 2 * pad, cell - 2 * pad))
        x, y = (i % cols) * cell, (i // cols) * (cell + 26)
        sheet.alpha_composite(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        d.text((x + pad, y + cell + 4), name, fill=(90, 90, 90, 255))
    sheet.convert("RGB").save(OUT / "_uebersicht.png", optimize=True)


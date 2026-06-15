#!/usr/bin/env python3
"""
Cosmology diagram generator for Ahvantir.

Computes the geometry for the planar cosmology diagram and emits a standalone
SVG into src/_includes/cosmology-diagram.svg, which src/cosmology.njk includes.

Building this from a script (rather than hand-placing coordinates) means the
16 outer planes land on a mathematically exact ring, and reordering or
re-spacing anything is a one-line change instead of a round of pixel-nudging.

Sections are added incrementally as they are approved:
  I.   Material plane + Elemental Chaos band      (approved)
  II.  Inner planes ring (Dreaming/Veil/Green)    (approved)
  III. Outer planes ring (16, Great Wheel)        (this pass)
  IV.  Astral/Ethereal background split           (pending)
  V.   The Ranjergon sphere + Far Realm           (pending)
"""

import math
from pathlib import Path

OUT = Path(__file__).parent.parent / "src" / "_includes" / "cosmology-diagram.svg"

# ── Canvas & core geometry ──────────────────────────────────────────
CX, CY = 460.0, 460.0          # center of the cosmos (the Material Plane)
R_MAT = 46.0                   # material plane radius
CHAOS_IN, CHAOS_OUT = 50.0, 82.0   # elemental chaos donut band
R_INNER = 158.0               # inner-planes orbital radius
R_INNER_BODY = 34.0           # inner plane sphere radius
R_OUTER = 362.0               # outer-planes orbital radius
R_OUTER_BODY = 29.0           # outer plane sphere radius
R_OUTER_LABEL = R_OUTER + 46  # label ring for outer planes


def fmt(n: float) -> str:
    """Trim floats to 1 decimal for compact, clean SVG."""
    return f"{n:.1f}".rstrip("0").rstrip(".")


def polar(cx, cy, r, deg):
    """Point on a circle. 0deg = east, +deg = clockwise (screen y-down)."""
    rad = math.radians(deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)


# ── Inner planes (approved layout: 120deg spacing) ──────────────────
# (name, subtitle, angle_deg, gradient_id, glow_color, slug)
INNER = [
    ("The Dreaming",  "Nodd's Sovereign Domain", -90.0, "rg-dream", "#7040b8", "the-dreaming"),
    ("The Vast Green", "The Fey Realm",            30.0, "rg-green", "#2f9a2f", "vast-green"),
    ("The Faded Veil", "The Dark Mirror",         150.0, "rg-veil",  "#3a2850", "faded-veil"),
]

# ── Outer planes (Great Wheel) ──────────────────────────────────────
# group: upper (gold) / lower (crimson) / neutral (steel).
# Elysium (pure NG) sits at top (-90); Hades (pure NE) at bottom (90),
# so Good is up, Evil is down, Chaos to the right, Law to the left.
# (full, short, group, slug)  — wheel order, index 1..16
OUTER_ORDER = [
    ("Mount Celestia",        "Celestia",     "upper",   "mount-celestia"),  # 1  LG
    ("Bytopia",               "Bytopia",      "upper",   "bytopia"),         # 2  LG/NG
    ("Elysium",               "Elysium",      "upper",   "elysium"),         # 3  NG  (top)
    ("The Beastlands",        "Beastlands",   "upper",   "the-beastlands"),  # 4  NG/CG
    ("Arborea",               "Arborea",      "upper",   "arborea"),         # 5  CG
    ("Ysgard",                "Ysgard",       "upper",   "ysgard"),          # 6  CG/CN
    ("Limbo",                 "Limbo",        "upper",   "limbo"),           # 7  CN  (right)
    ("Pandemonium",           "Pandemonium",  "lower",   "pandemonium"),     # 8  CN/CE
    ("The Abyss",             "The Abyss",    "lower",   "the-abyss"),       # 9  CE
    ("Carceri",               "Carceri",      "lower",   "carceri"),         # 10 CE/NE
    ("The Gray Waste (Hades)", "Hades",       "lower",   "hades"),           # 11 NE  (bottom)
    ("Gehenna",               "Gehenna",      "lower",   "gehenna"),         # 12 NE/LE
    ("The Nine Hells",        "Nine Hells",   "lower",   "the-nine-hells"),  # 13 LE
    ("Acheron",               "Acheron",      "lower",   "acheron"),         # 14 LE/LN
    ("Mechanus",              "Mechanus",     "neutral", "mechanus"),        # 15 LN  (left)
    ("Arcadia",               "Arcadia",      "neutral", "arcadia"),         # 16 LN/LG
]

GROUP_STYLE = {
    "upper":   {"grad": "rg-gold",    "glow": "#caa24a"},
    "lower":   {"grad": "rg-crimson", "glow": "#8a1f2a"},
    "neutral": {"grad": "rg-steel",   "glow": "#6a7488"},
}


def outer_angle(idx_1based: int) -> float:
    """Index 3 (Elysium) at top (-90), 22.5deg per step, clockwise."""
    return -90.0 + (idx_1based - 3) * 22.5


def link_open(slug: str, label: str) -> str:
    """Open an SVG hyperlink wrapping a plane's sphere and/or label. Trailing
    slash matches the site's article permalinks (/articles/<slug>/)."""
    return f'<a class="cosmos-link" href="/articles/{slug}/" aria-label="{label}">'


# ── Star field (fixed seed, hand-scattered for an even spread) ───────
STARS = [
    (90, 70, 1.3, 0.7), (210, 120, 0.9, 0.6), (700, 95, 1.4, 0.8),
    (820, 200, 0.9, 0.5), (70, 360, 1.2, 0.6), (850, 520, 0.9, 0.7),
    (780, 760, 1.3, 0.5), (140, 760, 0.9, 0.6), (320, 840, 1.3, 0.7),
    (620, 850, 0.9, 0.5), (180, 230, 0.6, 0.5), (380, 95, 0.6, 0.4),
    (560, 80, 0.6, 0.6), (880, 360, 0.6, 0.5), (895, 450, 0.6, 0.4),
    (885, 700, 0.6, 0.5), (110, 600, 0.6, 0.5), (50, 760, 0.6, 0.4),
    (250, 880, 0.6, 0.5), (720, 860, 0.6, 0.4), (40, 180, 0.7, 0.5),
    (470, 870, 0.6, 0.5), (660, 200, 0.5, 0.4), (300, 300, 0.5, 0.4),
]


def build() -> str:
    p = []
    a = p.append

    a('<svg viewBox="0 0 920 920" xmlns="http://www.w3.org/2000/svg" '
      'role="img" class="cosmos-svg">')
    a('<title>The Planar Cosmology of Ahvantir</title>')
    a('<desc>The Material Plane at the center, encircled by the Elemental '
      'Chaos, the three inner planes (the Dreaming, the Vast Green, the Faded '
      'Veil), and the sixteen outer planes of the Great Wheel arranged by '
      'alignment.</desc>')

    # ── defs ────────────────────────────────────────────────────────
    a('<defs>')
    a('<radialGradient id="rg-mp" cx="38%" cy="32%" r="65%">'
      '<stop offset="0%" stop-color="#c0e8f8"/>'
      '<stop offset="18%" stop-color="#5aba88"/>'
      '<stop offset="42%" stop-color="#2d6a42"/>'
      '<stop offset="68%" stop-color="#1a4a8a"/>'
      '<stop offset="100%" stop-color="#0a1a30"/></radialGradient>')
    a('<radialGradient id="rg-dream" cx="38%" cy="32%" r="65%">'
      '<stop offset="0%" stop-color="#f8f0ff"/>'
      '<stop offset="25%" stop-color="#c0a0f0"/>'
      '<stop offset="60%" stop-color="#6040a8"/>'
      '<stop offset="100%" stop-color="#100820"/></radialGradient>')
    a('<radialGradient id="rg-veil" cx="38%" cy="32%" r="65%">'
      '<stop offset="0%" stop-color="#8a8aaa"/>'
      '<stop offset="35%" stop-color="#3a2850"/>'
      '<stop offset="70%" stop-color="#18102a"/>'
      '<stop offset="100%" stop-color="#050208"/></radialGradient>')
    a('<radialGradient id="rg-green" cx="38%" cy="32%" r="65%">'
      '<stop offset="0%" stop-color="#e0ffc0"/>'
      '<stop offset="25%" stop-color="#70d840"/>'
      '<stop offset="58%" stop-color="#1a7020"/>'
      '<stop offset="100%" stop-color="#061208"/></radialGradient>')
    a('<radialGradient id="rg-gold" cx="38%" cy="30%" r="68%">'
      '<stop offset="0%" stop-color="#fff6da"/>'
      '<stop offset="30%" stop-color="#f0cf7a"/>'
      '<stop offset="65%" stop-color="#b3852c"/>'
      '<stop offset="100%" stop-color="#2a1c08"/></radialGradient>')
    a('<radialGradient id="rg-crimson" cx="38%" cy="30%" r="68%">'
      '<stop offset="0%" stop-color="#ffb0a0"/>'
      '<stop offset="28%" stop-color="#c43a30"/>'
      '<stop offset="62%" stop-color="#741420"/>'
      '<stop offset="100%" stop-color="#1c0408"/></radialGradient>')
    a('<radialGradient id="rg-steel" cx="38%" cy="30%" r="68%">'
      '<stop offset="0%" stop-color="#eef2f8"/>'
      '<stop offset="32%" stop-color="#9aa6ba"/>'
      '<stop offset="66%" stop-color="#4a5468"/>'
      '<stop offset="100%" stop-color="#0e1218"/></radialGradient>')
    # Astral wash — anchored top-left corner, fades to transparent toward center
    a('<radialGradient id="rg-astral" cx="6%" cy="4%" r="94%">'
      '<stop offset="0%" stop-color="#3e4f86" stop-opacity="0.85"/>'
      '<stop offset="36%" stop-color="#222d52" stop-opacity="0.5"/>'
      '<stop offset="72%" stop-color="#0a1024" stop-opacity="0"/></radialGradient>')
    # Ethereal wash — anchored bottom-right corner; overlaps astral mid-canvas
    a('<radialGradient id="rg-ethereal" cx="94%" cy="96%" r="94%">'
      '<stop offset="0%" stop-color="#2f5a52" stop-opacity="0.8"/>'
      '<stop offset="40%" stop-color="#1a322e" stop-opacity="0.5"/>'
      '<stop offset="74%" stop-color="#08120f" stop-opacity="0"/></radialGradient>')
    # The Ranjergon — radiant divine sphere
    a('<radialGradient id="rg-ranj" cx="38%" cy="30%" r="70%">'
      '<stop offset="0%" stop-color="#fffdf0"/>'
      '<stop offset="25%" stop-color="#ffe9a8"/>'
      '<stop offset="55%" stop-color="#e0a830"/>'
      '<stop offset="100%" stop-color="#6a3c08"/></radialGradient>')

    # soft glow
    a('<filter id="f-soft" x="-80%" y="-80%" width="260%" height="260%">'
      '<feGaussianBlur stdDeviation="6"/></filter>')
    a('<filter id="f-mist" x="-60%" y="-60%" width="220%" height="220%">'
      '<feGaussianBlur stdDeviation="22"/></filter>')
    a('<filter id="f-ranjglow" x="-90%" y="-90%" width="280%" height="280%">'
      '<feGaussianBlur stdDeviation="9"/></filter>')
    # Far Realm soft underglow
    a('<radialGradient id="rg-far" cx="30%" cy="70%" r="78%">'
      '<stop offset="0%" stop-color="#4a1a56" stop-opacity="0.45"/>'
      '<stop offset="35%" stop-color="#22360f" stop-opacity="0.28"/>'
      '<stop offset="70%" stop-color="#160a20" stop-opacity="0.12"/>'
      '<stop offset="100%" stop-color="#06030a" stop-opacity="0"/></radialGradient>')
    # Far Realm — turbulence-displaced blur for wrong, organic edges
    a('<filter id="f-far">'
      '<feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blr"/>'
      '<feTurbulence type="turbulence" baseFrequency="0.018" numOctaves="3" '
      'seed="13" result="nse"/>'
      '<feDisplacementMap in="blr" in2="nse" scale="26" '
      'xChannelSelector="R" yChannelSelector="G"/></filter>')
    # elemental chaos turbulence
    a('<filter id="f-chaos">'
      '<feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blr"/>'
      '<feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" '
      'seed="7" result="nse"/>'
      '<feDisplacementMap in="blr" in2="nse" scale="10" '
      'xChannelSelector="R" yChannelSelector="G"/></filter>')
    a(f'<mask id="m-chaos">'
      f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(CHAOS_OUT)}" fill="white"/>'
      f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(CHAOS_IN)}" fill="black"/></mask>')
    a('</defs>')

    # ── SECTION IV: background — the Astral / Ethereal split ─────────
    # Two fields make up the space between planes. They overlap (both washes
    # bleed toward the center), but each dominates one corner: the Astral as
    # structural scaffolding (top-left, silver lattice), the Ethereal as the
    # unseen background medium (bottom-right, soft mist).
    a('<!-- Background: Astral / Ethereal -->')
    a('<rect width="920" height="920" fill="#050210"/>')
    a('<rect width="920" height="920" fill="url(#rg-astral)"/>')
    a('<rect width="920" height="920" fill="url(#rg-ethereal)"/>')

    # Astral scaffolding — faint geometric lattice in the upper-left
    lat_nodes = [(55, 85), (235, 55), (150, 235), (350, 160),
                 (75, 345), (300, 340), (430, 70)]
    lat_edges = [(0, 1), (1, 6), (0, 2), (1, 2), (2, 3), (6, 3),
                 (1, 3), (2, 4), (2, 5), (3, 5), (4, 5)]
    a('<g opacity="0.5">')
    for i, j in lat_edges:
        x1, y1 = lat_nodes[i]
        x2, y2 = lat_nodes[j]
        a(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
          f'stroke="#8090c0" stroke-width="0.6" opacity="0.22"/>')
    for x, y in lat_nodes:
        a(f'<circle cx="{x}" cy="{y}" r="1.3" fill="#aab8e0" opacity="0.4"/>')
    a('</g>')

    # Ethereal mist — soft blurred fields in the lower-right
    a('<g filter="url(#f-mist)">')
    for mx, my, mr, mo in [(720, 720, 120, 0.18), (830, 640, 95, 0.14),
                            (640, 830, 110, 0.15), (860, 850, 80, 0.16)]:
        a(f'<circle cx="{mx}" cy="{my}" r="{mr}" fill="#2f6a5e" opacity="{mo}"/>')
    a('</g>')

    # Stars across both fields
    a('<g opacity="0.65">')
    for x, y, r, o in STARS:
        a(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#eef0ff" opacity="{o}"/>')
    a('</g>')

    # Field labels, tucked into opposite corners
    a(link_open("the-astral-sea", "The Astral Sea"))
    a('<text x="28" y="42" text-anchor="start" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="11" '
      'fill="#aab8e0" letter-spacing="0.14em" opacity="0.72">THE ASTRAL SEA</text>')
    a('<text x="28" y="56" text-anchor="start" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="8" '
      'fill="#7888b0" letter-spacing="0.04em" font-style="italic" opacity="0.6">'
      'the scaffolding between worlds</text>')
    a('</a>')
    a(link_open("the-ethereal", "The Ethereal"))
    a('<text x="892" y="884" text-anchor="end" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="11" '
      'fill="#88c0b0" letter-spacing="0.14em" opacity="0.72">THE ETHEREAL</text>')
    a('<text x="892" y="898" text-anchor="end" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="8" '
      'fill="#5e9084" letter-spacing="0.04em" font-style="italic" opacity="0.6">'
      'the unseen between-space</text>')
    a('</a>')

    # ── SECTION VI: the Far Realm ───────────────────────────────────
    # Drawn behind the wheel so the ordered cosmos holds against it. It
    # breaches at the bottom-left corner — set opposite the divine Ranjergon
    # — and reaches tendrils and watching eyes inward toward the planes.
    a('<!-- The Far Realm -->')
    # soft underglow halo at the breach
    a('<circle cx="95" cy="855" r="150" fill="url(#rg-far)"/>')
    # the breach mass — wrong, organic, displaced (deep, near-black tones)
    a('<g filter="url(#f-far)" opacity="0.9">')
    for bx, by, br, bc in [(60, 890, 95, "#2c1040"), (150, 870, 72, "#1c2c0c"),
                            (48, 800, 82, "#23103a"), (180, 905, 60, "#26340c"),
                            (110, 850, 60, "#3a1450"), (90, 912, 70, "#121e08")]:
        a(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{bc}"/>')
    a('</g>')
    # tendrils creeping inward toward the wheel
    a('<g fill="none" stroke-linecap="round" filter="url(#f-soft)">')
    for d, col, w, op in [
        ("M140,820 C200,758 244,718 286,688", "#324412", 8, 0.40),
        ("M120,802 C162,704 150,648 206,598", "#3a1450", 6, 0.34),
        ("M58,762 C36,684 60,624 30,556",     "#2a3a10", 5, 0.28),
        ("M196,902 C320,898 372,910 470,902", "#2a1442", 4, 0.22),
    ]:
        a(f'<path d="{d}" stroke="{col}" stroke-width="{w}" opacity="{op}"/>')
    a('</g>')
    # watching eyes — dim, sickly slit-pupil eyes peering from the corruption
    for ex, ey, s in [(108.0, 842.0, 1.5), (52.0, 726.0, 0.8), (238.0, 892.0, 0.72)]:
        a(f'<circle cx="{fmt(ex)}" cy="{fmt(ey)}" r="{fmt(15*s)}" '
          f'fill="#6a8a28" opacity="0.22" filter="url(#f-soft)"/>')
        a(f'<ellipse cx="{fmt(ex)}" cy="{fmt(ey)}" rx="{fmt(13*s)}" ry="{fmt(8*s)}" '
          f'fill="#8a9636"/>')
        a(f'<circle cx="{fmt(ex)}" cy="{fmt(ey)}" r="{fmt(6.5*s)}" fill="#3a4e10"/>')
        a(f'<ellipse cx="{fmt(ex)}" cy="{fmt(ey)}" rx="{fmt(2*s)}" ry="{fmt(6*s)}" '
          f'fill="#050603"/>')
        a(f'<circle cx="{fmt(ex-2.4*s)}" cy="{fmt(ey-2.6*s)}" r="{fmt(1.4*s)}" '
          f'fill="#c8d89a" opacity="0.6"/>')
    # label, rising from the breach
    a(link_open("the-far-realm", "The Far Realm"))
    a('<text x="22" y="900" text-anchor="start" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="11" '
      'fill="#6e8a30" letter-spacing="0.16em" opacity="0.85">THE FAR REALM</text>')
    a('<text x="22" y="914" text-anchor="start" '
      'font-family="Georgia,\'Times New Roman\',serif" font-size="8" '
      'fill="#4e6628" letter-spacing="0.04em" font-style="italic" opacity="0.7">'
      'that which should not be</text>')
    a('</a>')

    # ── orbital guide paths ─────────────────────────────────────────
    a(f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(R_INNER)}" fill="none" '
      f'stroke="#c9a96e" stroke-width="0.6" stroke-dasharray="5 9" opacity="0.20"/>')
    a(f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(R_OUTER)}" fill="none" '
      f'stroke="#c9a96e" stroke-width="0.6" stroke-dasharray="5 9" opacity="0.18"/>')

    # ── SECTION III: outer planes ───────────────────────────────────
    a('<!-- Outer planes (Great Wheel) -->')
    for i, (full, short, group, slug) in enumerate(OUTER_ORDER, start=1):
        ang = outer_angle(i)
        x, y = polar(CX, CY, R_OUTER, ang)
        style = GROUP_STYLE[group]
        a(link_open(slug, full))
        # glow
        a(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R_OUTER_BODY + 9)}" '
          f'fill="{style["glow"]}" opacity="0.20" filter="url(#f-soft)"/>')
        # body
        a(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R_OUTER_BODY)}" '
          f'fill="url(#{style["grad"]})"/>')
        # specular highlight
        hx, hy = x - R_OUTER_BODY * 0.32, y - R_OUTER_BODY * 0.36
        a(f'<ellipse cx="{fmt(hx)}" cy="{fmt(hy)}" rx="{fmt(R_OUTER_BODY*0.34)}" '
          f'ry="{fmt(R_OUTER_BODY*0.22)}" fill="#ffffff" opacity="0.16"/>')
        # label
        lx, ly = polar(CX, CY, R_OUTER_LABEL, ang)
        c = math.cos(math.radians(ang))
        if c > 0.3:
            anchor = "start"
        elif c < -0.3:
            anchor = "end"
        else:
            anchor = "middle"
        ly += 3  # optical centering
        a(f'<text x="{fmt(lx)}" y="{fmt(ly)}" text-anchor="{anchor}" '
          f'font-family="Georgia,\'Times New Roman\',serif" font-size="10.5" '
          f'fill="#d8c8a8" letter-spacing="0.04em">{short}</text>')
        a('</a>')

    # ── SECTION II: inner planes ────────────────────────────────────
    a('<!-- Inner planes -->')
    for full, sub, ang, grad, glow, slug in INNER:
        x, y = polar(CX, CY, R_INNER, ang)
        a(link_open(slug, full))
        a(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R_INNER_BODY + 12)}" '
          f'fill="{glow}" opacity="0.20" filter="url(#f-soft)"/>')
        a(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(R_INNER_BODY)}" '
          f'fill="url(#{grad})"/>')
        hx, hy = x - R_INNER_BODY * 0.32, y - R_INNER_BODY * 0.36
        a(f'<ellipse cx="{fmt(hx)}" cy="{fmt(hy)}" rx="{fmt(R_INNER_BODY*0.32)}" '
          f'ry="{fmt(R_INNER_BODY*0.20)}" fill="#ffffff" opacity="0.16"/>')
        # label sits outward from center (away from the hub)
        is_top = ang < -45
        ty = y - R_INNER_BODY - 14 if is_top else y + R_INNER_BODY + 22
        sy = ty + 13
        a(f'<text x="{fmt(x)}" y="{fmt(ty)}" text-anchor="middle" '
          f'font-family="Georgia,\'Times New Roman\',serif" font-size="13" '
          f'fill="#e8dcc4" letter-spacing="0.05em">{full}</text>')
        a(f'<text x="{fmt(x)}" y="{fmt(sy)}" text-anchor="middle" '
          f'font-family="Georgia,\'Times New Roman\',serif" font-size="9" '
          f'fill="#9a8a72" letter-spacing="0.03em" font-style="italic">{sub}</text>')
        a('</a>')

    # ── SECTION I: elemental chaos + material plane ─────────────────
    a('<!-- Elemental Chaos band -->')
    a(link_open("the-elemental-chaos", "The Elemental Chaos"))
    a('<g mask="url(#m-chaos)" filter="url(#f-chaos)">')
    # four elements blended: fire NE, earth SE, water SW, air NW
    bx, by = CX, CY
    a(f'<circle cx="{fmt(bx+46)}" cy="{fmt(by-34)}" r="74" fill="#e8521a"/>')   # fire
    a(f'<circle cx="{fmt(bx+46)}" cy="{fmt(by+34)}" r="74" fill="#9a7018"/>')   # earth
    a(f'<circle cx="{fmt(bx-46)}" cy="{fmt(by+34)}" r="74" fill="#1a48c0"/>')   # water
    a(f'<circle cx="{fmt(bx-46)}" cy="{fmt(by-34)}" r="74" fill="#88b8d8"/>')   # air
    a(f'<circle cx="{fmt(bx+40)}" cy="{fmt(by)}" r="44" fill="#c88020" opacity="0.55"/>')
    a(f'<circle cx="{fmt(bx-40)}" cy="{fmt(by)}" r="44" fill="#3888c0" opacity="0.55"/>')
    a('</g>')
    a(f'<text x="{fmt(CX + CHAOS_OUT + 8)}" y="{fmt(CY-3)}" '
      f'font-family="Georgia,\'Times New Roman\',serif" font-size="8.5" '
      f'fill="#c8a050" letter-spacing="0.10em" opacity="0.75">ELEMENTAL</text>')
    a(f'<text x="{fmt(CX + CHAOS_OUT + 8)}" y="{fmt(CY+9)}" '
      f'font-family="Georgia,\'Times New Roman\',serif" font-size="8.5" '
      f'fill="#c8a050" letter-spacing="0.10em" opacity="0.75">CHAOS</text>')
    a('</a>')

    a('<!-- Material Plane -->')
    a(link_open("ahvantir-the-material-plane", "Ahvantir (The Material Plane)"))
    a(f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(R_MAT)}" '
      f'fill="url(#rg-mp)" filter="url(#f-soft)"/>')
    a(f'<circle cx="{fmt(CX)}" cy="{fmt(CY)}" r="{fmt(R_MAT)}" fill="url(#rg-mp)"/>')
    a(f'<ellipse cx="{fmt(CX-13)}" cy="{fmt(CY-15)}" rx="14" ry="9" '
      f'fill="#e0f8ff" opacity="0.14"/>')
    a(f'<text x="{fmt(CX)}" y="{fmt(CY+4)}" text-anchor="middle" '
      f'font-family="Georgia,\'Times New Roman\',serif" font-size="11" '
      f'fill="#e8f4ee" letter-spacing="0.06em">Ahvantir</text>')
    a('</a>')

    # ── SECTION V: The Ranjergon — its own sphere, set apart ─────────
    # The Deific Plane sits outside the major cosmology, sealed behind the
    # Divine Gate. Rendered in the top-right corner, ringed by the Gate, with
    # no orbital tie to the wheel — deliberately separate.
    rx, ry, rr = 850.0, 80.0, 46.0
    a('<!-- The Ranjergon (Deific Plane), behind the Divine Gate -->')
    a(link_open("the-ranjergon", "The Ranjergon"))
    a(f'<circle cx="{fmt(rx)}" cy="{fmt(ry)}" r="{fmt(rr+16)}" '
      f'fill="#ffd060" opacity="0.16" filter="url(#f-ranjglow)"/>')
    # Divine Gate — concentric broken rings enclosing the sphere
    a(f'<circle cx="{fmt(rx)}" cy="{fmt(ry)}" r="{fmt(rr+18)}" fill="none" '
      f'stroke="#f0d890" stroke-width="1.2" stroke-dasharray="2 7" opacity="0.55"/>')
    a(f'<circle cx="{fmt(rx)}" cy="{fmt(ry)}" r="{fmt(rr+11)}" fill="none" '
      f'stroke="#e8c870" stroke-width="0.8" stroke-dasharray="1 6" opacity="0.4"/>')
    a(f'<circle cx="{fmt(rx)}" cy="{fmt(ry)}" r="{fmt(rr)}" fill="url(#rg-ranj)"/>')
    a(f'<ellipse cx="{fmt(rx-rr*0.32)}" cy="{fmt(ry-rr*0.36)}" '
      f'rx="{fmt(rr*0.30)}" ry="{fmt(rr*0.20)}" fill="#fffdf0" opacity="0.22"/>')
    a(f'<text x="{fmt(rx)}" y="{fmt(ry+rr+30)}" text-anchor="middle" '
      f'font-family="Georgia,\'Times New Roman\',serif" font-size="12" '
      f'fill="#f0dca0" letter-spacing="0.05em">The Ranjergon</text>')
    a(f'<text x="{fmt(rx)}" y="{fmt(ry+rr+43)}" text-anchor="middle" '
      f'font-family="Georgia,\'Times New Roman\',serif" font-size="8.5" '
      f'fill="#b09850" letter-spacing="0.03em" font-style="italic">'
      f'Behind the Divine Gate</text>')
    a('</a>')

    a('</svg>')
    return "\n".join(p)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build(), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(OUT.parent.parent.parent)}")


if __name__ == "__main__":
    main()

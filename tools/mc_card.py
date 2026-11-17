"""Project-card image for the photon Monte Carlo: a schematic head (source -> sample -> detector)
and what the spread of ray angles does to an alpha-Fe sextet. Everything is simulated here; no
measured spectrum and no CAD of the real head (both held back from the site).

Each ray from the moving source sees the drive velocity times cos(theta), theta = angle between
the ray and the drive axis, so a line at v0 is recorded at v0 / cos(theta): the lines broaden
outward. The toy geometry is chosen so the effect reads at thumbnail size.

    python -P tools/mc_card.py      -> assets/img/proj-montecarlo.png
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

SITE = Path(__file__).resolve().parents[1]
BG, INK, WHITE = "#1E211D", "#9DA39A", "#F2F3F0"
ORANGE, GREEN, PURPLE, GREY = "#E08A4F", "#6FBF8E", "#A99BC9", "#6E746C"
rng = np.random.default_rng(3)

fig = plt.figure(figsize=(12.52, 7.82), dpi=100, facecolor=BG)
ax = fig.add_axes([0.0, 0.0, 0.46, 1.0], facecolor=BG); ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis("off")

# sample plate
ax.plot([0.6, 9.4], [1.6, 1.6], color=WHITE, lw=3, solid_capstyle="butt")
ax.text(9.4, 1.0, "sample", color=INK, fontsize=22, ha="right")
# source housing, tilted 25 deg, drive axis along it
tilt = np.deg2rad(25)
c0 = np.array([3.0, 7.2]); axis = np.array([np.sin(tilt), -np.cos(tilt)])   # points at the sample
perp = np.array([axis[1], -axis[0]])
w, h = 1.25, 1.9
corners = [c0 + perp * sx * w + axis * sy * h for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1)]]
ax.plot(*np.array(corners).T, color=GREY, lw=7, solid_joinstyle="round")
mouth = c0 + axis * h
ax.text(*(c0 - axis * 2.6 + perp * 0.2), "source", color=INK, fontsize=22, ha="center")
# drive axis
ax.plot(*np.array([c0 - axis * 1.2, c0 + axis * ((1.6 - c0[1]) / axis[1])]).T, color=WHITE, lw=1.8, ls=(0, (5, 4)), alpha=0.85, zorder=5)
ax.text(*(c0 + axis * 4.9 + perp * 0.55), "drive axis", color=WHITE, fontsize=16, rotation=-65, ha="center", va="center", alpha=0.85, zorder=6)
# detector
det = np.array([7.6, 6.2])
ax.add_patch(plt.Rectangle(det - [0.75, 0.45], 1.5, 0.9, angle=0, color="#C9CED6"))
ax.plot([det[0] - 0.85, det[0] + 0.85], [det[1] - 0.5, det[1] - 0.5], color="#2A2E36", lw=6)
ax.text(det[0], det[1] + 0.75, "detector", color=INK, fontsize=22, ha="center")

# rays: source mouth -> sample (orange); sample -> detector (green)
thetas = []
for _ in range(70):
    p0 = mouth + perp * rng.uniform(-0.9, 0.9)
    d = axis + perp * rng.normal(0, 0.28); d /= np.linalg.norm(d)
    t = (1.6 - p0[1]) / d[1]; hit = p0 + d * t
    if not 0.8 < hit[0] < 9.2:
        continue
    thetas.append(np.arccos(np.clip(d @ axis, -1, 1)))
    ax.plot([p0[0], hit[0]], [p0[1], hit[1]], color=ORANGE, lw=1.1, alpha=0.45)
    if rng.random() < 0.55:
        tgt = det + [rng.uniform(-0.6, 0.6), -0.5]
        ax.plot([hit[0], tgt[0]], [hit[1], tgt[1]], color=GREEN, lw=1.1, alpha=0.45)
# theta arc on one ray
d1 = axis - perp * 0.5; d1 /= np.linalg.norm(d1)
ax.plot(*np.array([mouth, mouth + d1 * ((1.6 - mouth[1]) / d1[1])]).T, color=ORANGE, lw=2.6, zorder=5)
a0, a1 = np.arctan2(axis[1], axis[0]), np.arctan2(d1[1], d1[0])
arc = np.linspace(min(a0, a1), max(a0, a1), 30)
ax.plot(mouth[0] + 2.2 * np.cos(arc), mouth[1] + 2.2 * np.sin(arc), color=WHITE, lw=1.6)
ax.text(mouth[0] + 2.55 * np.cos((a0 + a1) / 2), mouth[1] + 2.55 * np.sin((a0 + a1) / 2) - 0.1, "θ",
        color=WHITE, fontsize=28, ha="center", va="center")

# spectrum: alpha-Fe sextet, input lines vs the same lines through the angle spread
v = np.linspace(-7.5, 7.5, 1500)
lines = [(-5.31, 3), (-3.08, 2), (-0.84, 1), (0.84, 1), (3.08, 2), (5.31, 3)]
G = 0.13
lor = lambda x0: G**2 / ((v - x0) ** 2 + G**2)
inp = sum(a * lor(x0) for x0, a in lines)
th = np.array(thetas)
cs = np.cos(rng.choice(th, 4000))
mc = sum(a * np.mean([lor(x0 / c) for c in cs[:400]], axis=0) for x0, a in lines)
mc *= inp.max() / mc.max() * 0.62
sp = fig.add_axes([0.50, 0.24, 0.47, 0.6], facecolor=BG)
sp.fill_between(v, 0, inp, color=GREY, alpha=0.55, lw=0)
sp.plot(v, mc, color=PURPLE, lw=3.2)
for s in sp.spines.values():
    s.set_visible(False)
sp.spines["bottom"].set_visible(True); sp.spines["bottom"].set_color(INK)
sp.set_yticks([]); sp.set_xticks([-5, 0, 5]); sp.tick_params(colors=INK, labelsize=18, length=0, pad=8)
sp.set_xlim(-7.5, 7.5); sp.set_ylim(0, 3.25)
sp.set_xlabel("source velocity (mm/s)", color=INK, fontsize=20)
sp.text(-7.3, 3.05, "lines the sample makes", color="#B9BEB6", fontsize=19)
sp.text(-7.3, 2.68, "what the detector records", color=PURPLE, fontsize=19)
fig.text(0.97, 0.93, "v cos θ", color=WHITE, fontsize=30, ha="right", family="serif", style="italic")
fig.text(0.97, 0.06, "SIMULATED", color=INK, fontsize=14, ha="right")

dst = SITE / "assets/img/proj-montecarlo.png"
fig.savefig(dst, facecolor=BG)
print(dst, dst.stat().st_size, "bytes; mean theta", round(float(np.rad2deg(th.mean())), 1), "deg")

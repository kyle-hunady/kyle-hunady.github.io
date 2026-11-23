"""Build assets/img/gt-eis-nyquist.png for battery.html (Part II) from Kyle's raw Gamry files.

Input (not copied into this repo): the sintered pellet's spectra, Li | Li2OHCl | Li, 1 MHz -> 1 Hz,
500 mV rms, 26 Sep 2020, in
  ~/Documents/1Research/planning/lab/data/gamry/2009-2010_li2ohcl_li-symm_eis/raw/BM101 12H S150C 2H/

Panels: 80, 100, 110 C on a kilo-ohm scale; 22 C alone on a scale 100x larger. 40 and 60 C are left
out (60 C ran off the top of the old warm panel). Capacitances in the labels come from each arc's
apex, C = 1 / (2 pi f_apex * 2 * (-Z'')_apex):
  grain-boundary arc  6.2-7.5 nF at 40-110 C (5 nF at 22 C)
  contact arc at 80 C  ~4 uF, apex near 40 Hz
  22 C small arc       ~0.1 nF, apex near 25 kHz (grain interiors)
The hook at 100/110 C (Z' falls below ~20 Hz) is discussed on the page.

    python tools/eis_nyquist.py [--check]
"""
import sys
from pathlib import Path
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

RAW = Path.home() / "Documents/1Research/planning/lab/data/gamry/2009-2010_li2ohcl_li-symm_eis/raw/BM101 12H S150C 2H"
OUT = Path(__file__).resolve().parents[1] / "assets/img/gt-eis-nyquist.png"
WARM = {80: "#d9731a", 100: "#1f6fb4", 110: "#3a9a4a"}
COLD = {22: "#555555"}


def read_dta(path):
    L = Path(path).read_text(encoding="latin1").splitlines()
    i = next(k for k, l in enumerate(L) if l.startswith("ZCURVE"))
    hdr = L[i + 1].split("\t")
    rows = []
    for l in L[i + 3:]:
        p = l.split("\t")
        try:
            rows.append([float(p[hdr.index(c)]) for c in ("Freq", "Zreal", "Zimag")])
        except (ValueError, IndexError):
            break
    a = np.array(rows)
    return a[:, 0], a[:, 1], a[:, 2]


def spec(t):
    return read_dta(RAW / f"2020-09-26_LBM101-12H-S150C-2H_{t:03d}C.DTA")


def panel(ax, temps, scale):
    for t, c in temps.items():
        f, zr, zi = spec(t)
        ax.plot(zr / scale, -zi / scale, "o-", ms=2.6, lw=.8, color=c, label=f"{t} °C")
        for dec in (1e6, 1e4, 1e2, 1):
            i = np.argmin(abs(np.log10(f) - np.log10(dec)))
            ax.plot(zr[i] / scale, -zi[i] / scale, "s", ms=5, mfc="white", mec=c, mew=1.1)
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlabel("Z′ (kΩ)"); ax.set_ylabel("−Z″ (kΩ)")
    ax.legend(fontsize=8, loc="upper right", frameon=False)


def note(ax, text, xy, xytext):
    ax.annotate(text, xy=xy, xytext=xytext, fontsize=8, arrowprops=dict(arrowstyle="-", lw=.6, color="0.3"))


def build():
    fig, (a, b) = plt.subplots(1, 2, figsize=(10.5, 3.4), gridspec_kw=dict(width_ratios=[1.25, 1]), layout="constrained")
    panel(a, WARM, 1e3)
    a.set_xlim(0, 6.6); a.set_ylim(0, 2.2)
    a.legend(fontsize=8, loc="lower left", bbox_to_anchor=(0.5, 0.02), frameon=False)
    a.set_title("Sintered pellet, Li | pellet | Li, 80 to 110 °C", fontsize=10)
    f, zr, zi = spec(110)
    note(a, "starts at the grains’\nresistance", (zr[0] / 1e3, 0.03), (0.1, 1.45))
    note(a, "grain boundaries\n(about 7 nF)", (3.0, 1.69), (3.5, 1.78))
    note(a, "lithium contacts\n(about 4 µF)", (5.45, 0.50), (4.7, 1.2))
    f, zr, zi = spec(100)
    note(a, "hook below 20 Hz", (zr[-1] / 1e3, -zi[-1] / 1e3), (2.35, 0.75))
    panel(b, COLD, 1e3)
    b.get_legend().remove()
    b.set_xlim(0, 620); b.set_ylim(0, 260)
    b.set_title("Same pellet at 22 °C (scale 100× larger)", fontsize=10)
    note(b, "grain interiors\n(about 0.1 nF)", (46, 33), (15, 130))
    note(b, "grain boundaries\n(about 5 nF)", (330, 202), (400, 222))
    b.text(0.98, 0.03, "squares mark 1 MHz, 10 kHz, 100 Hz, 1 Hz", transform=b.transAxes, ha="right", fontsize=7.5, color="0.35")
    return fig


if __name__ == "__main__":
    if "--check" in sys.argv:
        for t in (22, 40, 60, 80, 100, 110):
            f, zr, zi = spec(t); y = -zi
            pk = [i for i in range(1, len(f) - 1) if y[i] >= y[i - 1] and y[i] >= y[i + 1] and y[i] > 0.05 * y.max()]
            print(t, "C  Z'(1 Hz) = %.0f ohm" % zr[-1], "  apexes:",
                  ", ".join("%.3g Hz -> %.2g F" % (f[i], 1 / (2 * np.pi * f[i] * 2 * y[i])) for i in pk))
    else:
        build().savefig(OUT, dpi=200, bbox_inches="tight", pad_inches=.08)
        print(OUT)

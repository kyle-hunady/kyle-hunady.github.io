"""Build the published-data assets for entropy.html from the Acta Materialia paper's sources.

Inputs (the paper's own directory, not copied into this repo):
  data/<sample>.csv                      PPMS heat-capacity exports with processed columns
  figures/media/micrographs/*_scalebar.png  BSE micrographs with the instrument data bar

Outputs:
  assets/data/hea-cp.json   per sample: T, Cp, Cp/T, S (kB/atom), thinned for the page
  assets/img/hea-sem-*.jpg  micrographs, data bar cropped off (the page draws its own 10 um bar)

Entropy is re-integrated here from Cp/T (trapezoid), with the region below the lowest measured
point closed by a Cp/T = gamma + beta T^2 fit, so the curve and the table on the page come from
one calculation. `--check` prints S(385 K) against the paper's Table 3.

    python tools/entropy_assets.py [--check]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = Path(__file__).resolve().parents[1]
HEA = Path.home() / "Documents/1Research/HEA"
BUNDLES = HEA / "Al-addition/data/bundles"     # final processed Cp; reproduces Table 3 to 0.02 kB/atom
XRD = HEA / "xrd/data/all-alloys"
PAPER = Path.home() / "Documents/1Research/planning/papers/Contributions_to_the_Entropy_of_High_Entropy_Alloys"

# sample id -> (label, family, Al fraction label). Order = legend order.
SAMPLES = {
    "CCFN1": ("CoCrFeNi", "cantor", 0),
    "Ap2CCFN2": ("Al0.2CoCrFeNi", "cantor", 0.2),
    "ACCFN1": ("AlCoCrFeNi", "cantor", 1.0),
    "CCFMN1": ("CoCrFeMnNi", "cantor5", 0),
    "A1p25CCFMN1": ("Al1.25CoCrFeMnNi", "cantor5", 1.25),
    "NTTZ1": ("NbTa0.5TiZr", "refractory", 0),
    "Ap2NTTZ1": ("Al0.2NbTa0.5TiZr", "refractory", 0.2),
    "Ap3NTTZ1": ("Al0.3NbTa0.5TiZr", "refractory", 0.3),
}
# Paper Table 3(a), S_meas(385 K) in kB/atom
TABLE = {"CCFN1": 4.61, "Ap2CCFN2": 4.56, "ACCFN1": 4.23, "CCFMN1": 4.71, "A1p25CCFMN1": 4.27,
         "NTTZ1": 5.62, "Ap2NTTZ1": 5.40, "Ap3NTTZ1": 5.28}


def bundle(sid):
    return json.loads((BUNDLES / f"{sid}.json").read_text())


def load(sid):
    b = bundle(sid)
    T = np.array(b["cp"]["Sample Temp (Kelvin)"], float)
    ct = np.array(b["cp"]["Samp HC/T (kb/atom/K)"], float)
    o = np.argsort(T)
    f = b.get("lowt_fit") or {}
    return T[o], ct[o], f.get("gamma", 0.0), f.get("beta", 0.0)


def integrate(T, ct, g, b):
    """Trapezoid over the data; below the first point, the bundle's gamma T + beta T^3 fit."""
    S0 = g * T[0] + b * T[0] ** 3 / 3
    return S0 + np.concatenate([[0.0], np.cumsum(np.diff(T) * (ct[1:] + ct[:-1]) / 2)])


def thin(T, *ys, n=90):
    """Keep at most n points, log-spaced in T so the low-T region stays resolved."""
    if len(T) <= n:
        return (T,) + ys
    grid = np.geomspace(T[0], T[-1], n)
    idx = np.unique(np.searchsorted(T, grid).clip(0, len(T) - 1))
    return (T[idx],) + tuple(y[idx] for y in ys)


def build_cp(check=False):
    out = []
    for sid, (label, fam, x) in SAMPLES.items():
        T, ct, g, b = load(sid)
        S = integrate(T, ct, g, b)
        if check:
            print(f"{sid:12s} n={len(T):4d}  S385={np.interp(385, T, S):.3f}  table={TABLE[sid]:.2f}")
        Tt, ctt, St = thin(T, ct, S)
        out.append({"id": sid, "label": label, "family": fam, "x": x,
                    "S385_table": TABLE[sid],
                    "T": [round(v, 3) for v in Tt],
                    "Cp": [round(a * b, 4) for a, b in zip(ctt, Tt)],
                    "S": [round(v, 4) for v in St]})
    dst = SITE / "assets/data/hea-cp.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps({"units": "kB/atom", "source": "Hunady, Elmasri, Fultz, Acta Mater. 321, 122808 (2026)",
                               "samples": out}, separators=(",", ":")))
    print("wrote", dst.relative_to(SITE), f"{dst.stat().st_size/1024:.1f} KB")


def build_sem():
    mic = PAPER / "figures/media/micrographs"
    # (source, output, fraction of height above the instrument data bar)
    for src, dst in [("A1p25CCFMN1-etched_BSE_scalebar.png", "hea-sem-al125cocrfemnni.jpg"),
                     ("Ap2NTTZ1_BSE_scalebar.png", "hea-sem-al02nbta05tizr.jpg")]:
        im = Image.open(mic / src).convert("L")
        w, h = im.size
        im = im.crop((0, 0, w, int(h * 0.905)))          # data bar is the bottom ~9 %
        if im.width > 1400:
            im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
        # 10 um = 0.087 of the frame width in both images (measured off the instrument's own bar)
        dr = ImageDraw.Draw(im)
        W, H = im.size
        bw, th = round(0.087 * W), max(4, round(W / 220))
        x0, y0 = round(0.04 * W), round(0.94 * H)
        dr.rectangle((x0 - 2, y0 - 2, x0 + bw + 2, y0 + th + 2), fill=0)
        dr.rectangle((x0, y0, x0 + bw, y0 + th), fill=255)
        font = ImageFont.truetype("arialbd.ttf", max(16, round(W / 40)))
        dr.text((x0, y0 - 8), "10 µm", fill=255, anchor="ld", font=font, stroke_width=2, stroke_fill=0)
        p = SITE / "assets/img" / dst
        im.save(p, quality=84, optimize=True, progressive=True)
        print("wrote", p.relative_to(SITE), im.size, f"{p.stat().st_size/1024:.0f} KB")


def build_sim():
    """MACE (medium-omat-0) phonon Cp stored in the bundles: harmonic, or QHA where that is all there is."""
    out = []
    for sid in ["CCFN1", "ACCFN1", "CCFMN1", "NTTZ1", "Ap3NTTZ1"]:
        d = bundle(sid).get("dft_cp") or {}
        kind = "harmonic" if "harmonic" in d else "qha"
        T = np.array(d[kind]["T"], float); Cp = np.array(d[kind]["Cp"], float)
        m = T > 0; T, Cp = T[m], Cp[m]
        ct = Cp / T
        S = ct[0] * T[0] / 3 + np.concatenate([[0.0], np.cumsum(np.diff(T) * (ct[1:] + ct[:-1]) / 2)])  # Cp ~ T^3 below
        Tt, Ct, St = thin(T, Cp, S, n=80)
        print(f"sim {sid:9s} {kind:8s} T {T[0]:.0f}-{T[-1]:.0f}  Cp(300)={np.interp(300, T, Cp):.3f}  S385={np.interp(385, T, S):.3f}")
        out.append({"id": sid, "label": SAMPLES[sid][0], "kind": kind,
                    "T": [round(v, 2) for v in Tt], "Cv": [round(v, 4) for v in Ct], "S": [round(v, 4) for v in St]})
    dst = SITE / "assets/data/hea-sim.json"
    dst.write_text(json.dumps({"model": "MACE medium-omat-0 force field, phonopy", "alloys": out}, separators=(",", ":")))
    print("wrote", dst.relative_to(SITE), f"{dst.stat().st_size/1024:.1f} KB")


def build_xrd():
    """Cu K-alpha patterns of the eight paper alloys, each normalized to its strongest peak."""
    import pickle
    ids = ["CCFN1", "Ap2CCFN2", "ACCFN1", "CCFMN1", "A1p25CCFMN1", "NTTZ1", "Ap2NTTZ1", "Ap3NTTZ1"]
    out = []
    for i, f in enumerate(sorted(XRD.glob("0*_processed.pkl"))):
        d = pickle.loads(f.read_bytes())
        df = d["df"]; tt = df["TwoTheta"].to_numpy(float); I = df["I"].to_numpy(float)
        m = (tt >= 20) & (tt <= 90); tt, I = tt[m], I[m]
        k = 8                                           # 8000 points -> ~2000, max-pooled so peaks survive
        n = len(tt) // k * k
        tt = tt[:n].reshape(-1, k).mean(1); I = I[:n].reshape(-1, k).max(1)
        I = (I - np.percentile(I, 2)) / (I.max() - np.percentile(I, 2))
        out.append({"id": ids[i], "label": SAMPLES[ids[i]][0], "structure": d.get("structure"),
                    "file": f.name, "tt": [round(v, 3) for v in tt], "I": [round(max(v, 0), 4) for v in I]})
        print("xrd", ids[i], f.name[:40], d.get("structure"), len(tt))
    dst = SITE / "assets/data/hea-xrd.json"
    dst.write_text(json.dumps({"radiation": "Cu K-alpha", "patterns": out}, separators=(",", ":")))
    print("wrote", dst.relative_to(SITE), f"{dst.stat().st_size/1024:.1f} KB")


if __name__ == "__main__":
    build_cp(check="--check" in sys.argv)
    build_sim()
    build_xrd()
    build_sem()

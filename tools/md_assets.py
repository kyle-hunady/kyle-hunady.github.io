"""Build assets/data/hea-md.json for the molecular-dynamics figures on entropy.html.

Source: calc 034 in HEA/vasp/light-solute-refractory, MACE molecular dynamics of a 160-atom
Al0.3NbTa0.5TiZr supercell (4 x 4 x 5 BCC cells) at 50, 150 and 300 K. 2 fs steps, every 10th
step saved, 2000 saved frames after equilibration. Also the harmonic (phonopy-style) mode
frequencies of the same cell and the frequency shift MD found in each of the five cells.

Written per temperature: the first FRAMES saved frames as displacements from each atom's mean
position, quantized to Q angstrom in int8 and base64-encoded, plus the run's mean instantaneous
temperature and rms displacement. One frame = 20 fs.

    python -P tools/md_assets.py
"""
import base64
import json
from pathlib import Path

import numpy as np

SITE = Path(__file__).resolve().parents[1]
CALC = Path.home() / "Documents/1Research/HEA/vasp"
BULK = CALC / "results_archive/nersc/light-solute-refractory/034_mace_md"
RES = CALC / "light-solute-refractory/results/034_md"
FRAMES, Q = 150, 0.005
KB, AMU = 1.380649e-23, 1.66053907e-27


def main():
    out = {"source": "calc 034, MACE MD of Al0.3NbTa0.5TiZr, 160 atoms", "frame_fs": None,
           "q": Q, "temps": []}
    for T in (50, 150, 300):
        d = np.load(BULK / f"y30_T{T}/bulk/md_y30_T{T}.npz")
        pos, cell = d["pos"], np.diag(d["cell"])
        ref = pos.mean(axis=0)
        disp = pos - ref
        disp -= disp.mean(axis=1, keepdims=True)          # remove centre-of-mass drift
        if "ref" not in out:
            out["ref"] = np.round(ref - ref.min(axis=0), 3).tolist()
            out["cell"] = cell.round(3).tolist()
            out["symbols"] = [str(s) for s in d["symbols"]]
            out["frame_fs"] = float(d["dt_fs"]) * int(d["stride"])
            masses = {str(s): float(m) for s, m in zip(d["symbols"], d["masses"])}
        q = np.clip(np.round(disp[:FRAMES] / Q), -127, 127).astype(np.int8)
        rms = float(np.sqrt((disp ** 2).sum(axis=2).mean()))
        Tm = float(d["tinst"].mean())
        out["temps"].append({
            "T": T, "T_mean": round(Tm, 1), "T_sd": round(float(d["tinst"].std()), 1),
            "rms_A": round(rms, 4), "max_A": round(float(np.abs(disp[:FRAMES]).max()), 3),
            "v_rms_Nb": round(float(np.sqrt(3 * KB * Tm / (masses["Nb"] * AMU))), 0),
            "disp": base64.b64encode(q.tobytes()).decode()})
    m = np.load(RES / "y30_T300_modes.npz")
    out["f_harm_THz"] = np.round(np.sort(m["f_harm_all"][m["f_harm_all"] > 0.05]), 3).tolist()
    c = json.loads((RES / "compare.json").read_text())["cells"]
    out["shift_pct"] = {k: {"T": v["T"], "df": [round(x, 2) for x in v["delta_f_pct"]],
                            "se": [round(x, 2) for x in v["delta_f_se_pct"]]} for k, v in c.items()}
    out["masses"] = masses
    dst = SITE / "assets/data/hea-md.json"
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(dst, dst.stat().st_size, "bytes")
    for t in out["temps"]:
        print(t["T"], t["T_mean"], t["rms_A"], t["max_A"], t["v_rms_Nb"])


if __name__ == "__main__":
    main()

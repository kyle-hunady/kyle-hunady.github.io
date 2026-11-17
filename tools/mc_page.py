"""Assets for montecarlo.html, taken from the SiNRG review-slide builders instead of drawn fresh.

Kyle, 2026-11-16: "reuse some of the existing infrastructure for the graphics ... use the slides for reference on
what are good comparisons (e.g. the ver1 ver2 ver3 progression) ... the slide that shows a basic example of source to
aperture distance and the effect on smearing ... show the pipeline with the kernel as an example (the photo ->
annotated -> 3d ray tracing -> angle distribution (off source axis) -> kernel matrix)".

Where each piece comes from (nothing is re-simulated here):
  * source-distance trade: the year-end deck's 30 / 8 / 1 mm panels (reviews/2611_yearend_spectra_figures/
    v2_rays_*mm.png, v2_srcdist_spec_*mm.png) and their numbers from analysis/261102_uckert_pareto/pareto.json.
    A GENERIC head, not ours.
  * ver1 / ver2 / ver3: the 3-D bodies and rays from analysis/261113_ver123_comparison/build_page.head_traces (the
    renderer the ver123 slide and report use), its ver123.json numbers and ver123_photons.npz spectra.
  * pipeline: the 2026-09-25 alpha-Fe run, which is the ver2 geometry. Annotated photo and the rays registered back on
    it are the annotator / ray_overlay outputs; the 3-D view is head_traces('ver2'); the off-axis angles are
    ver123_photons.npz['ver2_theta']; the kernel matrix is analyze_260926_fe_backscatter_kernel.kernel_matrix (the page rebuilds it in the
    browser from the same (cos theta, weight) pairs; k_row_8p5 is the Python row the browser must reproduce).

    python -P tools/mc_page.py     (system python: plotly, numpy, PIL)
        -> assets/img/mc/*, assets/data/mc.json
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
R1 = Path.home() / "Documents/1Research"
SINRG = R1 / "sinrg"
REV = SINRG / "reviews"
FIGS = REV / "2611_yearend_spectra_figures"
MC = SINRG / "mossbauer/backscatter-monte-carlo"
SM = SINRG / "mossbauer/backscatter-mossbauer/sinrg-mossbauer"
RUN0925 = Path.home() / "Desktop/SINRG_runs/260925_Fe-backscatter_with-aperture_8mm/mc"
IMG = SITE / "assets/img/mc"
DATA = SITE / "assets/data/mc.json"
IMG.mkdir(parents=True, exist_ok=True)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m


def r(x, n=3):
    return float(f"{x:.{n}g}")


# ---------------------------------------------------------------- 1. source distance (generic head, slide panels)
def setback():
    P = json.loads((MC / "analysis/261102_uckert_pareto/pareto.json").read_text(encoding="utf-8"))
    rows = P["rows"]
    out = []
    for sd in (30, 8, 1):
        row = min(rows, key=lambda q: abs(q["standoff_mm"] - sd))
        for kind, src in (("rays", FIGS / f"v2_rays_{sd}mm.png"), ("spec", FIGS / f"v2_srcdist_spec_{sd}mm.png")):
            shutil.copyfile(src, IMG / f"setback_{kind}_{sd}mm.png")
        out.append(dict(mm=sd, standoff=r(row["standoff_mm"]), eff=row["eff"], fwhm=r(row["fwhm"]),
                        spot=r(row["spot_d90_mm"], 2), stretch=r(row["sec_minus_1_pct"])))
    for o in out:
        o["speed"] = r(o["eff"] / out[0]["eff"], 2)
    return dict(rows=out, geometry=P.get("geometry", {}))


# ---------------------------------------------------------------- 2. ver1 / ver2 / ver3 (the ver123 study's renderer)
def ver123():
    sys.path.insert(0, str(REV))
    V = load("ver123_slide", REV / "ver123_slide.py")
    B = V._study()
    keys = ("ver1", "ver2", "ver3pb")
    figs = {}
    for k in keys:
        import plotly.io as pio
        T = [json.loads(pio.to_json(t, validate=False)) for t in B.head_traces(k, show=True, n_rays=45)]
        figs[k] = T
    rows = {k: B.ROWS[k] for k in ("ver1", "ver2", "ver3", "ver3pb")}
    ref = rows["ver2"]
    num = {}
    for k, q in rows.items():
        num[k] = dict(name=B.NAME[k], color=B.COL[k],
                      x_ver2=r(q["eff_4pi"] / ref["eff_4pi"]), eff=r(q["eff_4pi"]),
                      smear=r(q["smear_sec_minus_1_pct"]))
    N = B.NPZ
    v = N["v"]
    keep = slice(None, None, 4)
    spec = dict(v=[round(float(x), 3) for x in v[keep]],
                expected=[round(float(x), 4) for x in N["expected"][keep]])
    for k in keys:
        spec[k] = [round(float(x), 4) for x in N[f"{k}_spec"][keep]]
    scene = dict(aspectmode="manual", aspectratio=dict(x=1, y=1, z=0.95), camera=B.CAMERA,
                 xaxis=dict(range=[-32, 32], title="x (mm)"), yaxis=dict(range=[-32, 32], title="y (mm)"),
                 zaxis=dict(range=[-1, 60], title="z (mm)"))
    theta = np.degrees(np.asarray(N["ver2_theta"], float))
    return figs, num, spec, scene, theta, float(B.SETBACK), bodies(B)


def bodies(B):
    """The traced bodies per head, as the ver123 study's body_table() lists them, with public source labels."""
    sys.path.insert(0, str(R1 / "utilities/research-kit"))
    from research_kit.region_table import RegionTable
    src = {"ver1": "original design drawing", "ver2": "measured from the photo", "ver3pb": "CAD of the next design, "
           f"source moved {B.SETBACK:.1f} mm back"}
    st = {"ver1": "assumed", "ver2": "photo", "ver3pb": "derived"}
    ex = []
    for k in ("ver1", "ver2", "ver3pb"):
        g, nm = B.ROWS[k]["geometry"], {"ver1": "ver1", "ver2": "ver2", "ver3pb": "ver3"}[k]
        ex += [dict(id=f"{nm}-S", name=f"{nm}: 57Co active area", mat="Co in Rh",
                    dims=f"disk Ø8, {g['source_face_to_sample_along_axis_mm']:.1f} from the sample, axis "
                         f"{g['source_tilt_from_normal_deg']:.1f}° off normal", source=src[k], status=st[k],
                    transported=True),
               dict(id=f"{nm}-O", name=f"{nm}: limiting opening", mat="Pb",
                    dims=f"Ø{g['aperture_d_mm']:.1f}, {g['source_to_exit_mm']:.2f} in front of the source",
                    source=src[k], status=st[k], transported=True),
               dict(id=f"{nm}-D", name=f"{nm}: detector chip", mat="Si",
                    dims=f"Ø7.7, {g['chip_to_sample_along_axis_mm']:.2f} from the sample, axis "
                         f"{g['detector_tilt_from_normal_deg']:.1f}° off normal", source=src[k], status=st[k],
                    transported=True)]
    ex.append(dict(id="P", name="sample plane (all heads)", mat="re-emitter", dims="infinite plane z = 0",
                   source="study assumption", status="assumed", transported=True))
    rt = RegionTable([], extras=ex, frame="Sample frame: sample at z = 0, +z toward the head. Distances in mm.")
    rt.assume("line broadening", "geometry only: detector resolution, source line width and drive error left out",
              "assumed", "this study")
    rt.assume("detected photons per head", "about 30,000 (ver1 33,350, ver2 33,430, ver3 30,008)", "computed",
              "the ver1/ver2/ver3 study")
    rt.assume("statistical error", "about 0.5 % on counts per decay, 0.01 % on stretch", "computed",
              "the ver1/ver2/ver3 study")
    return rt.html()


# ---------------------------------------------------------------- 3. pipeline images + kernel matrix
def pipeline(theta):
    a = Image.open(RUN0925 / "Photos_syLhIw4Noc_sinrg_enc_annotated.png").convert("RGB")
    a.save(IMG / "pipe_annotated.jpg", quality=86)
    b = Image.open(FIGS / "s7b_raytrace_photo_head.png").convert("RGB")
    b.save(IMG / "pipe_rays_on_photo.jpg", quality=86)
    edges = np.arange(0.0, 30.5, 0.5)
    h, _ = np.histogram(theta, edges)
    sys.path.insert(0, str(SM))
    k26 = load("k26", SM / "analyze_260926_fe_backscatter_kernel.py")
    c = np.cos(np.radians(0.5 * (edges[1:] + edges[:-1])))
    q = h / h.sum()
    ok = q > 0
    v = np.round(np.arange(-11.0, 11.0001, 0.1), 2)
    K = k26.kernel_matrix(v, v, c[ok], q[ok])
    sec = 1 / np.cos(np.radians(theta))
    return dict(edges=[float(x) for x in edges], counts=[int(x) for x in h], n=int(theta.size),
                mean_deg=r(float(theta.mean())), max_deg=r(float(theta.max())),
                stretch=r(100 * (sec.mean() - 1)), spread=r(100 * sec.std()),
                v=[float(v[0]), float(v[-1]), len(v)],
                k_row_8p5=[round(float(x), 5) for x in K[int(np.argmin(abs(v - 8.5)))]])


def main():
    sb = setback()
    figs, num, spec, scene, theta, setback_mm, table = ver123()
    page = SITE / "montecarlo.html"
    h = page.read_text(encoding="utf-8")
    a, b = "<!-- bodies:start -->", "<!-- bodies:end -->"
    if a in h:
        h = h[:h.index(a) + len(a)] + "\n" + table + "\n" + h[h.index(b):]
        page.write_text(h, encoding="utf-8")
    pipe = pipeline(theta)
    DATA.write_text(json.dumps(dict(setback=sb, heads=figs, scene=scene, num=num, spec=spec, pipe=pipe,
                                    setback_mm=round(setback_mm, 2)), separators=(",", ":"), default=float, allow_nan=False),
                    encoding="utf-8")
    print("mc.json", DATA.stat().st_size // 1024, "KB")
    print("setback", [(o["mm"], o["speed"], o["fwhm"], o["spot"]) for o in sb["rows"]])
    print({k: (n["x_ver2"], n["smear"], n["eff"]) for k, n in num.items()})
    print("pipe", {k: pipe[k] for k in ("n", "mean_deg", "max_deg", "stretch", "spread")})


if __name__ == "__main__":
    main()

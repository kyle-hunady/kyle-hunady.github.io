"""Scrolling strip for the literature project card (index.html, assets/js/cards.js).

Cuts the 128 first-page tiles out of assets/img/proj-literature.jpg (16 x 8 grid, 78 x 96 px pitch,
4 px black gutters) and lays them out SETS times side by side: set 0 is the mosaic unchanged, so the
first frame of the animation matches the static image; each later set is a reshuffle of the same
128 papers (no paper shown that the static card doesn't already show). The strip's width is a whole
number of 78 px pitches, so repeat-x tiling has no seam.

    python -P tools/lit_strip.py   -> assets/img/proj-literature-strip.jpg
"""
from pathlib import Path

import numpy as np
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
SETS, PX, PY, NC, NR, H_OUT, Q = 3, 78, 96, 16, 8, 460, 70

src = Image.open(SITE / "assets/img/proj-literature.jpg").convert("RGB")
tiles = [src.crop((c * PX, r * PY, (c + 1) * PX, (r + 1) * PY)) for r in range(NR) for c in range(NC)]
rng = np.random.default_rng(7)
strip = Image.new("RGB", (SETS * NC * PX, NR * PY + 4), (0, 0, 0))
for s in range(SETS):
    order = np.arange(len(tiles)) if s == 0 else rng.permutation(len(tiles))
    for k, i in enumerate(order):
        r, c = divmod(k, NC)
        strip.paste(tiles[i], ((s * NC + c) * PX, r * PY))
# the mosaic's last 4 px row is the bottom gutter (772 = 8 * 96 + 4); keep the same height ratio
strip = strip.resize((round(strip.width * H_OUT / strip.height), H_OUT), Image.LANCZOS)
dst = SITE / "assets/img/proj-literature-strip.jpg"
strip.save(dst, quality=Q, optimize=True, progressive=True)
print(dst, strip.size, dst.stat().st_size // 1024, "KB")

"""Move the labels on the Monte Carlo project card so no text sits on a line.

assets/img/proj-montecarlo.png was composited by hand on 2026-11-18 (3-D head from the page engine +
spectrum panel); no script rebuilds it. This edits that PNG in place, once:

  * legend ("lines the sample makes" / "what the detector records") moves up into the empty band above
    the peaks; the slice of the -5.3 mm/s peak it covered is redrawn from the same Lorentzian
    (G = 0.147 mm/s and 39.5 px per mm/s, both measured off the image);
  * "source" moves left, off the drive-axis line and the top of the source housing.

    python -P tools/mc_card_relabel.py [in.png] [out.png]   (-P: tools/copy.py shadows the stdlib)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = Path(__file__).resolve().parents[1]
src = Path(sys.argv[1]) if len(sys.argv) > 1 else SITE / "assets/img/proj-montecarlo.png"
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src

BG, FILL, BLUE, PURPLE, LABEL = (31, 32, 30), (42, 52, 66), (99, 164, 255), (180, 140, 240), (163, 163, 155)
X0, PX, AXIS_Y, TIP_H, G = 921, 39.5, 594, 437, 0.147     # 0 mm/s pixel, px per mm/s, axis row, tip height, HWHM
VC = (710.3 - X0) / PX                                   # left outer line centre, measured (708-712 px at y=200)
FONT = "C:/Windows/Fonts/segoeui.ttf"

im = Image.open(src).convert("RGB")
a = np.asarray(im).copy()

# 1. legend: blank its old box, then repaint the peak slice that ran through it
y0, y1, xa, xb = 122, 203, 626, 945
a[y0:y1, xa:xb] = BG
SS = 6                                                   # supersampling for an antialiased edge
for x in range(696, 728):
    for y in range(y0, y1):
        inside = 0
        for sx in range(SS):
            v = (x + (sx + 0.5) / SS - X0) / PX
            yc = AXIS_Y - TIP_H * G**2 / ((v - VC) ** 2 + G**2)
            inside += sum(y + (sy + 0.5) / SS > yc for sy in range(SS))
        f_in = inside / (SS * SS)
        px = np.array(BG) * (1 - f_in) + np.array(FILL) * f_in
        a[y, x] = px.astype(np.uint8)

# blue edge: trace both flanks of the peak at sub-pixel resolution
img = Image.fromarray(a)
big = img.crop((690, y0 - 4, 734, y1 + 4)).resize((44 * SS, (y1 - y0 + 8) * SS), Image.NEAREST)
d = ImageDraw.Draw(big)
pts = []
for i in range(0, 44 * SS):
    v = (690 + i / SS - X0) / PX
    yc = AXIS_Y - TIP_H * G**2 / ((v - VC) ** 2 + G**2)
    pts.append((i, (yc - (y0 - 4)) * SS))
d.line(pts, fill=BLUE, width=int(2.0 * SS))
img.paste(big.resize((44, y1 - y0 + 8), Image.LANCZOS).crop((0, 4, 44, 4 + y1 - y0)), (690, y0))

draw = ImageDraw.Draw(img)
font = ImageFont.truetype(FONT, 24)
draw.text((634, 62), "lines the sample makes", font=font, fill=BLUE)
draw.text((634, 100), "what the detector records", font=font, fill=PURPLE)

# 2. "source": erase bright pixels above the housing's top ellipse, redraw the label to the left
a = np.asarray(img).copy()
lum = a.astype(int).sum(axis=2)
for x in range(60, 160):
    ye = 71.7 - (x - 137) * 0.2256 if x >= 137 else 71.7 + (137 - x) * 0.6   # top edge of the housing
    for y in range(36, int(ye - 1.2)):
        if lum[y, x] > sum(BG) + 12:
            a[y, x] = BG
a[68, 144:149] = BG                                      # the old "e" fused onto the housing edge here
img = Image.fromarray(a)
ImageDraw.Draw(img).text((18, 38), "source", font=font, fill=LABEL)

img.save(dst, optimize=True)
print(dst, dst.stat().st_size, "bytes")

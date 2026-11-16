"""Give each outreach row a people photo when one exists.

Run with `python -P tools/outreach_photos.py` (tools/copy.py shadows the stdlib
copy module otherwise). Drop originals in assets/img/outreach/src/<org>.(jpg|jpeg|png|webp)
with org in {gsab, gsc, alpine, maker}. This script resizes to 1400 px, strips all
metadata (re-encodes pixels only), writes assets/img/outreach/<org>.jpg, and
rewrites the matching .org row in index.html so the photo sits on the left
with the logo as a small badge on its corner (the makerspace row has no logo).
Rows without a photo keep the plain logo tile. Safe to re-run.
"""
import os, re, glob
from PIL import Image, ImageOps
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'assets', 'img', 'outreach')
SRC = os.path.join(OUT, 'src')
os.makedirs(SRC, exist_ok=True)
ALT = {'gsab': 'Graduate Student Advisory Board members',
       'gsc': 'Caltech Graduate Student Council members, 2025',
       'alpine': 'A Caltech Alpine Club group hike',
       'maker': 'Drilling a part on a drill press in a Georgia Tech makerspace'}

done = {}
for org in ALT:
    hits = [p for p in glob.glob(os.path.join(SRC, org + '.*')) if p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if not hits:
        continue
    im = ImageOps.exif_transpose(Image.open(hits[0])).convert('RGB')
    im.thumbnail((1400, 1400), Image.LANCZOS)
    clean = Image.frombytes('RGB', im.size, im.tobytes())   # pixels only, no EXIF/GPS
    clean.save(os.path.join(OUT, org + '.jpg'), quality=82, optimize=True)
    done[org] = clean.size

MAKER_BADGES = ('<span class="org__badges"><span class="org__badge org__badge--light org__badge--wide"><img src="assets/img/logos/hive.svg" alt="The Hive makerspace logo" width="113" height="40"></span><span class="org__badge org__badge--text" title="Materials Innovation and Learning Laboratory">MILL</span></span>')
ROW = r'<div class="org(?: org--photo)?">(?:<div class="org__photo">.*?</div>)?'
s = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
for org, (w, h) in done.items():
    if org == 'maker':
        pat = re.compile(ROW + r'<div class="org__logo org__logo--none"><svg><use href="#i-flask"/></svg></div>', re.S)
    else:
        pat = re.compile(ROW + r'<div class="org__logo[^"]*"><img src="assets/img/logos/' + org + r'[.]png"([^>]*)></div>', re.S)
    m = pat.search(s)
    if not m:
        print('row not found for', org)
        continue
    badge = ''
    if org == 'maker':
        badge = MAKER_BADGES
    else:
        light = ' org__badge--light' if org == 'gsab' else ''
        badge = '<span class="org__badge%s"><img src="assets/img/logos/%s.png"%s></span>' % (light, org, m.group(1))
    new = ('<div class="org org--photo"><div class="org__photo"><img src="assets/img/outreach/%s.jpg" alt="%s" '
           'width="%d" height="%d" loading="lazy">%s</div>') % (org, ALT[org], w, h, badge)
    s = s[:m.start()] + new + s[m.end():]
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)
print('photos placed:', done or 'none yet (drop files in %s)' % SRC)

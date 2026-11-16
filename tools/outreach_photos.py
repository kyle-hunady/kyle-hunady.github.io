"""Give each outreach row a people photo when one exists.

Run with `python -P tools/outreach_photos.py` (tools/copy.py shadows the stdlib
copy module otherwise). Drop originals in assets/img/outreach/src/<org>.(jpg|jpeg|png|heic->convert first)
with org in {gsab, gsc, alpine}. This script resizes to 1400 px, strips all
metadata (re-encodes pixels only), writes assets/img/outreach/<org>.jpg, and
rewrites the matching .org row in index.html so the photo sits on the left
with the logo as a small badge on its corner. Rows without a photo keep the
plain logo tile. Safe to re-run.
"""
import os, re, glob
from PIL import Image, ImageOps
SITE = r'C:/Users/kyleh/Documents/2Projects/kylehunady.github.io'
OUT = os.path.join(SITE, 'assets/img/outreach')
SRC = os.path.join(OUT, 'src')
os.makedirs(SRC, exist_ok=True)
ALT = {'gsab': 'Graduate Student Advisory Board members', 'gsc': 'Graduate Student Council members',
       'alpine': 'A Caltech Alpine Club trip'}

done = {}
for org in ALT:
    hits = [p for p in glob.glob(os.path.join(SRC, org + '.*')) if p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if not hits:
        continue
    im = ImageOps.exif_transpose(Image.open(hits[0])).convert('RGB')
    im.thumbnail((1400, 1400), Image.LANCZOS)
    clean = Image.new('RGB', im.size); clean.putdata(list(im.getdata()))   # pixels only, no EXIF/GPS
    clean.save(os.path.join(OUT, org + '.jpg'), quality=82, optimize=True)
    done[org] = clean.size

s = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
for org, (w, h) in done.items():
    # the logo tile for this org, whatever state it is in now
    pat = re.compile(r'<div class="org(?: org--photo)?">(?:<div class="org__photo">.*?</div>)?<div class="org__logo[^"]*"><img src="assets/img/logos/%s\.png"([^>]*)></div>' % org, re.S)
    m = pat.search(s)
    if not m:
        print('row not found for', org); continue
    logo = '<img src="assets/img/logos/%s.png"%s>' % (org, m.group(1))
    new = ('<div class="org org--photo"><div class="org__photo"><img src="assets/img/outreach/%s.jpg" alt="%s" width="%d" height="%d" loading="lazy">'
           '<span class="org__badge%s">%s</span></div>') % (org, ALT[org], w, h, ' org__badge--light' if org == 'gsab' else '', logo)
    s = s[:m.start()] + new + s[m.end():]
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)

css_path = os.path.join(SITE, 'assets/css/site.css')
css = open(css_path, encoding='utf-8').read()
if '.org--photo' not in css:
    css += '''
/* outreach rows with a photo of the people: photo left, logo as a corner badge */
.org--photo { grid-template-columns: 15rem 1fr; }
.org__photo { position: relative; border-radius: 0.6rem; overflow: hidden; aspect-ratio: 3 / 2; background: var(--surface-2); }
.org__photo > img { height: 100%; }
.org__badge { position: absolute; left: 0.45rem; bottom: 0.45rem; width: 2.6rem; height: 2.6rem; border-radius: 0.5rem;
              background: rgba(11,12,11,0.78); display: grid; place-items: center; backdrop-filter: blur(4px); }
.org__badge--light { background: rgba(237,235,228,0.92); }
.org__badge img { width: 78%; height: auto; object-fit: contain; }
@media screen and (max-width: 640px) { .org--photo { grid-template-columns: 1fr; } }
'''
    open(css_path, 'w', encoding='utf-8', newline='\n').write(css)
print('photos placed:', done or 'none yet (drop files in %s)' % SRC)

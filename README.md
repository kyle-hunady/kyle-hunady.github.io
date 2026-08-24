# kyle-hunady.github.io

Personal site. Static HTML, one stylesheet, one script, no build step and no dependencies.
Push to `main` and GitHub Pages serves it at <https://kyle-hunady.github.io>.

```
index.html            the site — hero, about, research, outreach, projects, contact
latte.html            the latte gallery (grid + lightbox)
about.html            \
research.html          > noindex redirects into index.html, kept for old inbound links
projects.html         /
assets/css/site.css   every style, both pages
assets/js/site.js     nav highlighting + copy-to-clipboard
assets/js/latte-dates.js   generated: photo number -> date
assets/img/latte/     001.jpg … the gallery, 1 = oldest
coffee-cropper/       LOCAL ONLY, gitignored: the Python cropper and its photo working set
```

## Local preview

```bash
python -m http.server 3456
```

## The design system

Everything visual is a CSS custom property in the `:root` block of `assets/css/site.css`.
Change a token there rather than a value in a rule.

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-2` | Elevation is a lighter surface, not a heavier border. |
| Text | `--white`, `--muted`, `--faint` | Three levels, nothing else. `--faint` is 4.90:1 on `--bg`, which is AA for the 10–12px labels that use it. |
| Accent | `--accent`, `--accent-deep`, `--accent-dim` | Sage, sampled from the headshot. The interactive colour. |
| Type | `--mono`, `--sans` | IBM Plex Mono for UI and headings, IBM Plex Sans for body copy. |
| Width | `--w-lg`, `--w-md`, `--w-sm` | The centred column at desktop, tablet, phone. |

Two rules worth keeping:

- **De-emphasise with colour, not size.** Secondary text goes to `--muted` or `--faint` and stays
  at a readable size.
- **One primary action per view.** `.btn-primary` is a solid fill; everything else is `.btn`.
  If a view has two solid buttons, one of them is wrong.

**Both pages share `site.css` and the same floating icon rail.** They used to run on separate
stylesheets with separate navs and separate webfonts, which read as two different sites. Do not
reintroduce a page-local stylesheet or a second nav pattern — add to `site.css` instead.

## Adding latte photos

1. Drop the new originals in `coffee-cropper/input/` and run the cropper; crops land in
   `coffee-cropper/export/`.
2. From inside `coffee-cropper/`, run:

```bash
python rename_exports.py
```

That sorts the exports by EXIF capture date, renames them `001.jpg`, `002.jpg`, … (1 = oldest), and
rewrites `assets/js/latte-dates.js`. Copy the renamed files into `assets/img/latte/`.

The gallery reads its photo list, its count and its date range from `latte-dates.js` alone, so there
is no number anywhere to update by hand. It renders newest first. If that file is empty the gallery
says so instead of rendering broken images.

`coffee-cropper/` is **gitignored**. It held 742 MB of full-resolution source photos that GitHub
Pages was serving publicly. Untracked *and* **purged from history** 2026-08-23 with
`git filter-repo`, which took the repo from **742 MB to 12.6 MB**; the HEAD tree hash was identical
before and after, so nothing published was lost. The directory still exists locally, so the cropper
and `rename_exports.py` work as before.

The same pass stripped every blob over 400 KB from history (the old ~1.7 MB gallery photos) and the
files belonging to the deleted pages. **A clone before 2026-08-23 has incompatible history** — delete
it and re-clone rather than pulling.

## Conventions

## Editing the words

Three ways, cheapest first.

**1. Edit the HTML.** Every paragraph is on one source line and there are no HTML entities left
except two load-bearing `&nbsp;` in "2 K" and "400 K", so the sentence you see on the page is the
sentence you can search for:

```bash
grep -n "smaller and more capable" index.html
```

That was not true before 2026-08-23: 21 of 24 paragraphs were wrapped mid-sentence across source
lines, which meant you could not grep text you were looking at.

**2. Edit one plain text file.** `tools/copy.py` walks the same elements in the same order every
time and swaps the text inside them. No build step, no template engine, and the HTML stays the
source of truth.

```bash
python tools/copy.py                     # list all 73 blocks with file:line
python tools/copy.py --export copy.txt   # dump them to a text file
python tools/copy.py --import copy.txt   # write your edits back
python tools/copy.py --check             # prove a round trip changes nothing
```

`--check` is the guarantee: it exports, re-imports unchanged, and asserts both HTML files are
byte-identical. If a key in your file matches nothing on the site, the import **writes nothing** and
tells you which key — it will not half-apply. A few blocks carry inline `<sup>` or `<strong>`; the
listing marks them `[has markup]` and those tags must stay.

**3. Edit on github.com** for a one-line fix from anywhere, including a phone. Commits from the web
editor deploy on their own:

<https://github.com/kyle-hunady/kyle-hunady.github.io/edit/main/index.html>

After any of the three, run the tone gate before pushing (see below), and remember Pages caches for
ten minutes — hard-reload before deciding a change did not land.

## Information architecture

Five sections, in the order a first-time visitor needs them: **about, research, outreach, projects,
contact**. The rule is one home per fact.

- **About** is who he is and where, in his own plain register. It carries both degrees and the
  current position, so nothing else on the page repeats them — an Education row was removed
  2026-08-23 for exactly that duplication.
- **Research** is research: the three positions, then publications. Education and leadership used to
  sit here too, under a heading that names neither.
- **Outreach** is its own section rather than a row inside Research, because it is a real part of the
  work and was invisible where it was.
- **Projects** is a grid of eight cards, each a photo and one or two sentences. It is a map, not a
  repository: there are no per-project detail pages, and the three that existed were deleted because
  their copy oversold the work.
- **Contact** is one line and three buttons.

Before changing any copy, run the tone gate:

```bash
python ~/Documents/1Research/planning/ops/site_tone_check.py index.html latte.html
```

It measures the three things that actually go wrong here — AI vocabulary and cadences (the
"not just X, but Y" reveal), punctuation density per 100 words, and rigid sentence structure
(monotone lengths, most sentences opening with the same word). It reports measurements, not verdicts.

## Conventions

- **About is short and in Kyle's own voice**, and stays that way. The long paragraph-form
  Long paragraph-form versions were cut 2026-08-23 as filler. Publications are labeled rows in
  Research; leadership and teaching live in Outreach.
- Say less. Every project is a photo and one or two sentences. A claim the published record does
  not support does not go on the site — including in a playful register, where "small enough to fly
  to another planet" quietly asserts a flight qualification that is still in progress.
- **Plain declaratives, not quirk.** The tone brief is dry, or Kyle's own words. No superlatives, no
  editorializing, no jokes written for effect.
- **Gallery photos ship at 1000 px, q82.** They render in a 142 px cell and at most ~440 px in the
  lightbox, so the full-resolution crops (1.7 MB each, 195 MB total) were 16x of pure waste.
- No `mailto:` anywhere — the email buttons copy the address and say so.
- Only link a repo that has code in it.
- New interactive controls are real `<button>` or `<a>` elements so keyboard and touch work without
  extra code.

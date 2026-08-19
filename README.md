# kyle-hunady.github.io

Personal site. Static HTML, one stylesheet, two small scripts, no build step and no dependencies.
Push to `main` and GitHub Pages serves it at <https://kyle-hunady.github.io>.

```
index.html            home — hero + three section cards
research.html         the two research projects, publications, CV
projects.html         code and side projects
latte.html            the latte gallery (grid + lightbox)
about.html            background, education, leadership, contact
monte-carlo.html      project writeup — Mössbauer ray-tracer
coffee-cropper.html   project writeup — the photo cropper
gumball.html          The Latte Machine (SVG toy, linked from latte.html)
assets/css/style.css  every shared style
assets/js/main.js     scroll reveal, mobile nav, profile flip card
assets/js/latte-dates.js   generated: photo number → date
coffee-cropper/       the Python cropper that produces assets/img/latte/
knowledge.md          voice and tone notes for writing site copy
```

## Local preview

```bash
python -m http.server 3456
```

## The design system

Everything visual is a CSS custom property in the `:root` block of `assets/css/style.css`.
Change a token there rather than a value in a rule.

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `--bg`, `--surface`, `--surface2`, `--surface3` | Each step is one level nearer the reader. Elevation is a lighter surface, not a heavier border. |
| Text | `--text`, `--text-2`, `--text-3` | Three levels, nothing else. All three clear WCAG AA (4.5:1) on every surface. |
| Accent | `--accent`, `--accent-ink`, `--accent2` | Green is the interactive colour. `--accent-ink` is the only text colour that goes on a solid accent fill. |
| Type | `--fs-100` … `--fs-900` | 12 / 14 / 16 / 18 / 20 / 24 / 30 / 38 / 48 px. Nothing on the site is smaller than 12px. |
| Space | `--sp-1` … `--sp-9` | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px. |
| Depth | `--shadow-1/2/3` | Card hover, drawer, lightbox. |

Two rules worth keeping:

- **De-emphasise with colour, not size.** Secondary text goes to `--text-2` or `--text-3` and stays
  at a readable size. That is why there are no 9px labels any more.
- **One primary action per view.** `.pill-accent` is a solid fill; everything else is `.pill` or
  `.btn-quiet`. If a page has two solid buttons, one of them is wrong.

Legacy aliases (`--text-dim`, `--text-muted`, `--border2`) still exist because the three project
pages carry their own `<style>` blocks. They point at the current tokens, so those pages inherit
palette fixes for free.

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
is no number anywhere to update by hand. If that file is empty the gallery says so instead of
rendering broken images.

## Conventions

- Copy follows `knowledge.md`. Plain, specific, no reaching for a clever line.
- Every page shares the same nav, drawer and footer markup. Change one, change all eight.
- New interactive controls are real `<button>` or `<a>` elements so keyboard and touch work without
  extra code. The site has one focus style; don't add another.

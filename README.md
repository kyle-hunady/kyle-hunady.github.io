# kyle-hunady.github.io

Personal site. Static HTML, one stylesheet, one script, no build step and no dependencies.
Push to `main` and GitHub Pages serves it at <https://kyle-hunady.github.io>.

```
index.html            the site — hero, about, research, projects, contact
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
Pages was serving publicly; it was untracked 2026-08-23. The directory still exists locally, so the
cropper and `rename_exports.py` work as before. Removing it from HEAD does not shrink a clone — the
blobs are still in history. Purging them needs a rewrite plus a force-push, which is a separate call.

## Conventions

- Say less. Every project is a photo and one or two sentences. A claim the published record does
  not support does not go on the site.
- No `mailto:` anywhere — the email buttons copy the address and say so.
- Only link a repo that has code in it.
- New interactive controls are real `<button>` or `<a>` elements so keyboard and touch work without
  extra code.

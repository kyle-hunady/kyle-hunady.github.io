"""Write the breadcrumb trail at the top of every subpage.

    python tools/crumbs.py            # all pages in PAGES
    python tools/crumbs.py sinrg.html # just one

The trail (a div, not a <nav>: site.css styles every <nav> as the floating icon rail)
goes first inside the page header (`<div class="container header__container">`)
and replaces the old "All projects" back-link in <main>, which said the same thing lower
down. A BreadcrumbList JSON-LD block goes in <head> so search results show the path.
Both live between marker comments, so re-running the script rewrites them in place.
A new subpage = one row in PAGES, then run this.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://kyle-hunady.github.io/"

RESEARCH = ("Research", "index.html#research")
PROJECTS = ("Projects", "index.html#projects")

# page -> (section or None, short label for this page)
PAGES = {
    "entropy.html": (RESEARCH, "Alloy entropy"),
    "sinrg.html": (RESEARCH, "Reading rocks with gamma rays"),
    "montecarlo.html": (PROJECTS, "Spectrometer modeling"),
    "battery.html": (PROJECTS, "Battery materials"),
    "automation.html": (PROJECTS, "Literature workflow"),
    "bc.html": (PROJECTS, "Early coding"),
    "art.html": (PROJECTS, "Art and making"),
    "latte.html": (None, "Latte log"),
}

# Standalone artifact pages (a report copied in whole, with its own styles, like a PDF): no site.css and no
# trail, just one plain link back to the site page that presents it. Re-run after copying a rebuilt report in.
# page -> (site page it belongs to, link text)
ARTIFACTS = {
    "lit/grcop.html": ("automation.html", "Kyle Hunady · Literature workflow"),
}
BACK_OPEN, BACK_CLOSE = "<!-- backlink -->", "<!-- /backlink -->"

HTML_OPEN, HTML_CLOSE = "<!-- crumbs -->", "<!-- /crumbs -->"
LD_OPEN, LD_CLOSE = "<!-- crumbs-ld -->", "<!-- /crumbs-ld -->"
HEADER = '<div class="container header__container">'
BACK_LINK = re.compile(r'[ \t]*<a href="index\.html[^"]*" class="back-link">.*?</a>[ \t]*\n?')


def trail(page, section, label):
    return [("Home", "index.html")] + ([section] if section else []) + [(label, page)]


def crumbs_html(steps):
    items = [f'<li><a href="{href}">{name}</a></li>' for name, href in steps[:-1]]
    items.append(f'<li aria-current="page">{steps[-1][0]}</li>')
    return f'{HTML_OPEN}<div class="crumbs" role="navigation" aria-label="Breadcrumb"><ol>{"".join(items)}</ol></div>{HTML_CLOSE}'


def crumbs_ld(steps):
    data = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name,
             "item": SITE + ("" if href == "index.html" else href)}
            for i, (name, href) in enumerate(steps, 1)
        ],
    }
    return f'{LD_OPEN}<script type="application/ld+json">{json.dumps(data, ensure_ascii=False)}</script>{LD_CLOSE}'


def strip_block(text, open_, close):
    # Take the block's own line with it, so a re-run never stacks indentation.
    return re.sub(r"\n[ \t]*" + re.escape(open_) + ".*?" + re.escape(close), "", text, flags=re.S)


def apply(page):
    section, label = PAGES[page]
    path = ROOT / page
    text = path.read_text(encoding="utf-8")
    text = strip_block(strip_block(text, HTML_OPEN, HTML_CLOSE), LD_OPEN, LD_CLOSE)
    if HEADER not in text:
        raise SystemExit(f"{page}: no page header to put the trail in")
    steps = trail(page, section, label)
    text = text.replace(HEADER, f"{HEADER}\n    {crumbs_html(steps)}", 1)
    text = text.replace("</head>", f"\n{crumbs_ld(steps)}</head>", 1)
    # The back-link sat at the top of <main> (or of #gallery on latte); the trail replaces it.
    # latte.html keeps its badge row, so drop only the anchor there.
    text, n = BACK_LINK.subn("", text, count=1)
    path.write_text(text, encoding="utf-8", newline="")
    print(f"{page:18s} {' / '.join(s[0] for s in steps)}{'' if n else '   (no back-link found)'}")


def apply_artifact(page):
    parent, text_ = ARTIFACTS[page]
    path = ROOT / page
    text = path.read_text(encoding="utf-8")
    text = re.sub(re.escape(BACK_OPEN) + ".*?" + re.escape(BACK_CLOSE) + "\n?", "", text, flags=re.S)
    href = "../" * page.count("/") + parent
    link = (f'{BACK_OPEN}<div style="font:14px/1.4 system-ui,sans-serif;padding:10px 30px;border-bottom:1px solid #e2e6ea">'
            f'<a href="{href}" style="color:#1a4e8a;text-decoration:none">&larr; {text_}</a></div>{BACK_CLOSE}\n')
    text, n = re.subn(r"(<body[^>]*>\n?)", lambda m: m.group(1) + link, text, count=1)
    if not n:
        raise SystemExit(f"{page}: no <body> tag")
    path.write_text(text, encoding="utf-8", newline="")
    print(f"{page:18s} back link -> {href}")


if __name__ == "__main__":
    for page in sys.argv[1:] or [*PAGES, *ARTIFACTS]:
        apply_artifact(page) if page in ARTIFACTS else apply(page)

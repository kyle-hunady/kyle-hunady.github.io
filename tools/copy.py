#!/usr/bin/env python3
"""Edit every word on the site from one plain text file.

    python tools/copy.py                     # show all copy, with file:line
    python tools/copy.py --export copy.txt   # dump it to a text file
    ...edit copy.txt in any editor...
    python tools/copy.py --import copy.txt   # write it back into the HTML

There is no build step and no template engine. The HTML stays the source of
truth; this walks the same elements in the same order every time and swaps the
text inside them, so an export followed immediately by an import leaves the
files byte-identical. `--check` proves that.

Inline markup is shown as-is, because hiding it would make the round trip
lossy. Most lines are plain words; a few carry <sup>57</sup> or <strong>.
"""
import argparse
import io
import os
import re
import sys

PAGES = ['index.html', 'latte.html']

# Elements that hold copy, in one alternation so a single pass yields document
# order. Anything not listed here is structure and is never touched.
ELEMENT_RE = re.compile(
    r'<(?P<tag>p|h1|h2|h3)(?P<attrs>[^>]*)>(?P<inner>[^<>]*(?:<(?!/?(?:p|h1|h2|h3)\b)[^>]*>[^<>]*)*)</(?P=tag)>'
    r'|<div class="(?P<cls>header__eyebrow|header__role|exp__when|exp__role|exp__where|project__tag|project__title)"'
    r'>(?P<dinner>[^<>]*)</div>'
    r'|<span class="chip chip--state">(?P<chip>[^<>]*)</span>'
)


def slots(src):
    """Every editable span in document order: (start, end, text, label)."""
    out = []
    for m in ELEMENT_RE.finditer(src):
        if m.group('inner') is not None:
            out.append((m.start('inner'), m.end('inner'), m.group('inner'), m.group('tag')))
        elif m.group('dinner') is not None:
            out.append((m.start('dinner'), m.end('dinner'), m.group('dinner'), m.group('cls')))
        else:
            out.append((m.start('chip'), m.end('chip'), m.group('chip'), 'chip'))
    return out


def section_of(src, pos):
    """Nearest <section id> above this position, for a readable key."""
    ids = [(m.start(), m.group(1)) for m in re.finditer(r'<section id="([a-z]+)"', src)]
    cur = 'header'
    for start, sid in ids:
        if start < pos:
            cur = sid
    return cur


def collect(root):
    """[(page, key, line, text, span)] for every editable span on the site."""
    rows = []
    for page in PAGES:
        path = os.path.join(root, page)
        if not os.path.exists(path):
            continue
        src = io.open(path, encoding='utf-8').read()
        seen = {}
        for start, end, text, kind in slots(src):
            if not text.strip():
                continue
            sec = section_of(src, start)
            base = '%s/%s/%s' % (page.replace('.html', ''), sec, kind)
            seen[base] = seen.get(base, 0) + 1
            key = '%s%s' % (base, '' if seen[base] == 1 else '#%d' % seen[base])
            line = src.count('\n', 0, start) + 1
            rows.append((page, key, line, text, (start, end)))
    return rows


def apply_edits(root, edits):
    """edits: {(page, key): new_text}. Rewrites spans back-to-front."""
    changed = {}
    rows = collect(root)
    per_page = {}
    for page, key, line, text, span in rows:
        per_page.setdefault(page, []).append((key, text, span))

    for page, items in per_page.items():
        path = os.path.join(root, page)
        src = io.open(path, encoding='utf-8').read()
        n = 0
        for key, old, (start, end) in sorted(items, key=lambda x: -x[2][0]):
            new = edits.get((page, key))
            if new is None or new == old:
                continue
            src = src[:start] + new + src[end:]
            n += 1
        if n:
            io.open(path, 'w', encoding='utf-8', newline='\n').write(src)
            changed[page] = n
    return changed


HEADER = """# Every word on the site. Edit the text under each [key] and run:
#     python tools/copy.py --import this-file
#
# Do not change or reorder the [key] lines. Blank lines inside a block are
# ignored. Lines starting with # are comments. A few blocks carry inline HTML
# (<sup>, <strong>, <i>) -- leave those tags in place.
"""


def do_export(root, dest):
    rows = collect(root)
    with io.open(dest, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(HEADER)
        page = None
        for p, key, line, text, _ in rows:
            if p != page:
                page = p
                fh.write('\n\n# ===== %s =====\n' % p)
            fh.write('\n[%s]  (%s:%d)\n%s\n' % (key, p, line, text.strip()))
    print('wrote %s -- %d editable blocks' % (dest, len(rows)))


def parse_file(path):
    edits, key, buf = {}, None, []
    for raw in io.open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        m = re.match(r'^\[([^\]]+)\]', line)
        if m:
            if key:
                edits[key] = ' '.join(buf).strip()
            key, buf = m.group(1), []
        elif line.startswith('#') or not line.strip():
            continue
        elif key:
            buf.append(line.strip())
    if key:
        edits[key] = ' '.join(buf).strip()
    return edits


def do_import(root, src_file):
    parsed = parse_file(src_file)
    rows = collect(root)
    known = {key: page for page, key, _, _, _ in rows}
    unknown = [k for k in parsed if k not in known]
    if unknown:
        print('ERROR: %d key(s) in %s match nothing on the site:' % (len(unknown), src_file))
        for k in unknown:
            print('   [%s]' % k)
        print('Nothing was written. Re-export and edit that file instead.')
        return 1
    edits = {(known[k], k): v for k, v in parsed.items()}
    changed = apply_edits(root, edits)
    if not changed:
        print('no changes')
    for page, n in changed.items():
        print('%s -- %d block(s) updated' % (page, n))
    return 0


def do_check(root):
    """Export then import unchanged: the files must not move a single byte."""
    import hashlib
    import tempfile
    before = {}
    for page in PAGES:
        path = os.path.join(root, page)
        if os.path.exists(path):
            before[page] = hashlib.sha256(io.open(path, 'rb').read()).hexdigest()
    tmp = os.path.join(tempfile.gettempdir(), 'copy_roundtrip.txt')
    do_export(root, tmp)
    rc = do_import(root, tmp)
    ok = True
    for page, h in before.items():
        now = hashlib.sha256(io.open(os.path.join(root, page), 'rb').read()).hexdigest()
        state = 'unchanged' if now == h else 'CHANGED -- round trip is LOSSY'
        if now != h:
            ok = False
        print('  %-12s %s' % (page, state))
    print('round trip: %s' % ('clean' if ok and rc == 0 else 'BROKEN'))
    return 0 if (ok and rc == 0) else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--export', metavar='FILE')
    ap.add_argument('--import', dest='imp', metavar='FILE')
    ap.add_argument('--check', action='store_true',
                    help='prove an export/import round trip changes nothing')
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if args.check:
        return do_check(root)
    if args.export:
        do_export(root, args.export)
        return 0
    if args.imp:
        return do_import(root, args.imp)

    rows = collect(root)
    page = None
    for p, key, line, text, _ in rows:
        if p != page:
            page = p
            print('\n===== %s =====' % p)
        flat = re.sub(r'\s+', ' ', text).strip()
        mark = ' [has markup]' if '<' in flat else ''
        print('%s:%-4d %-34s %s%s'
              % (p, line, key, flat[:66] + ('…' if len(flat) > 66 else ''), mark))
    print('\n%d editable blocks. --export FILE to edit them all at once.' % len(rows))
    return 0


if __name__ == '__main__':
    sys.exit(main())

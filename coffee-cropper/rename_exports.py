#!/usr/bin/env python3
"""
Reads EXIF DateTimeOriginal from every JPG in the export folder,
sorts by date taken, and renames to 001.jpg, 002.jpg, etc.

Run with --dry-run to preview without changing anything.
"""

import os
import sys
import argparse
from datetime import datetime
from PIL import Image
from PIL.ExifTags import TAGS

EXPORT_FOLDER = "export"
VALID_EXT     = (".jpg", ".jpeg")
TAG_ORIGINAL  = 36867   # DateTimeOriginal
TAG_DIGITIZED = 36868   # DateTimeDigitized
TAG_DATETIME  = 306     # DateTime (fallback)
EXIF_FMT      = "%Y:%m:%d %H:%M:%S"


def read_date_taken(path):
    try:
        img  = Image.open(path)
        exif = img._getexif()
        if exif:
            for tag_id in (TAG_ORIGINAL, TAG_DIGITIZED, TAG_DATETIME):
                val = exif.get(tag_id)
                if val:
                    return datetime.strptime(val.strip(), EXIF_FMT)
    except Exception:
        pass
    # Fall back to file modification time so the file still gets included
    return datetime.fromtimestamp(os.path.getmtime(path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would happen without renaming")
    args = parser.parse_args()

    files = [
        f for f in os.listdir(EXPORT_FOLDER)
        if f.lower().endswith(VALID_EXT)
    ]

    if not files:
        print("No JPG files found in export/")
        return

    # Collect (date, path) pairs
    dated = []
    for f in files:
        path = os.path.join(EXPORT_FOLDER, f)
        dt   = read_date_taken(path)
        dated.append((dt, path, f))
        print(f"  {f:45s}  {dt.strftime('%Y-%m-%d %H:%M:%S')}")

    dated.sort(key=lambda x: x[0])

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Renaming {len(dated)} files:\n")

    pad = len(str(len(dated)))

    for i, (dt, path, original) in enumerate(dated, start=1):
        new_name = f"{str(i).zfill(3)}.jpg"
        new_path = os.path.join(EXPORT_FOLDER, new_name)
        print(f"  {original:45s}  ->  {new_name}  ({dt.strftime('%Y-%m-%d %H:%M:%S')})")
        if not args.dry_run:
            os.rename(path, new_path)

    if args.dry_run:
        print("\n(dry run — no files changed)")
    else:
        print("\nDone.")


if __name__ == "__main__":
    main()

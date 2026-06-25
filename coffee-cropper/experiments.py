#!/usr/bin/env python3
"""
coffee-cropper detection experiments.

Tests 4 approaches for locating the coffee/cup circle:
  1. hough_gray         — HoughCircles on blurred grayscale (resized)
  2. white_saucer       — LAB white-mask -> largest contour -> enclosing circle
  3. two_stage          — white-saucer center, then Hough inside that ROI for
                          the inner cup rim (the actual coffee circle)
  4. bilateral_hough    — bilateral-filtered grayscale -> HoughCircles

Each method saves:
  experiments/<method>/debug_<filename>  — detected circle drawn on original
  experiments/<method>/crop_<filename>   — square crop result

A summary report is written to experiments/report.txt.
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageOps

# ── config ──────────────────────────────────────────────────────────
INPUT_FOLDER = "input"
EXP_FOLDER   = "experiments"
BUFFER_RATIO = 0.12      # padding added to detected radius for crop
WORK_SIZE    = 900       # rescale longest edge to this before Hough
VALID_EXT    = (".jpg", ".jpeg", ".png", ".tif", ".tiff")

# Heuristic "good detection" thresholds (as fraction of min image dimension)
MIN_R_RATIO  = 0.12
MAX_R_RATIO  = 0.62
MAX_DIST_RATIO = 0.42    # max allowed distance of circle center from image center


# ── image loading ────────────────────────────────────────────────────

def load(path):
    pil = Image.open(path)
    pil = ImageOps.exif_transpose(pil)
    rgb = np.array(pil)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def resize_for_hough(image, max_dim=WORK_SIZE):
    h, w = image.shape[:2]
    scale = max_dim / max(h, w)
    if scale >= 1.0:
        return image, 1.0
    return cv2.resize(image, (int(w * scale), int(h * scale))), scale


# ── drawing helpers ──────────────────────────────────────────────────

def draw_circle(image, cx, cy, r, color=(0, 255, 0), thickness=3):
    out = image.copy()
    cv2.circle(out, (int(cx), int(cy)), int(r), color, thickness)
    cv2.circle(out, (int(cx), int(cy)), 10, (0, 0, 255), -1)  # center dot
    return out


def draw_none(image, msg="NO DETECTION"):
    out = image.copy()
    cv2.putText(out, msg, (30, 60), cv2.FONT_HERSHEY_SIMPLEX,
                1.4, (0, 0, 255), 3, cv2.LINE_AA)
    return out


# ── cropping ─────────────────────────────────────────────────────────

def square_crop(image, cx, cy, r, buffer=BUFFER_RATIO):
    h, w = image.shape[:2]
    half = int(r * (1 + buffer))
    x1, y1 = max(0, int(cx - half)), max(0, int(cy - half))
    x2, y2 = min(w, int(cx + half)), min(h, int(cy + half))
    return image[y1:y2, x1:x2]


# ── METHOD 1: hough_gray ─────────────────────────────────────────────

def method_hough_gray(image):
    """
    Plain HoughCircles on resized + blurred grayscale.
    Picks the circle closest to the image center.
    """
    h, w = image.shape[:2]
    small, scale = resize_for_hough(image)
    sh, sw = small.shape[:2]
    small_center = np.array([sw / 2, sh / 2])

    gray    = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    min_dim_s = min(sh, sw)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=int(min_dim_s * 0.30),
        param1=100,
        param2=28,
        minRadius=int(min_dim_s * MIN_R_RATIO),
        maxRadius=int(min_dim_s * MAX_R_RATIO),
    )
    if circles is None:
        return None

    circles = circles[0]
    best = min(circles, key=lambda c: np.linalg.norm(small_center - c[:2]))
    cx, cy, r = best / scale   # scale back to full resolution
    return cx, cy, r


# ── METHOD 2: white_saucer ───────────────────────────────────────────

def method_white_saucer(image):
    """
    Threshold high-L pixels in LAB (the white saucer/cup rim).
    Fit a minimum enclosing circle to the largest white contour.
    """
    h, w = image.shape[:2]
    min_dim = min(h, w)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    L   = lab[:, :, 0]

    # L > 175 captures the white ceramic saucer reliably
    _, mask = cv2.threshold(L, 175, 255, cv2.THRESH_BINARY)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k, iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Largest blob = the saucer
    biggest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(biggest) < (min_dim * 0.05) ** 2:
        return None

    (cx, cy), r = cv2.minEnclosingCircle(biggest)
    if r < min_dim * MIN_R_RATIO or r > min_dim * MAX_R_RATIO * 1.3:
        return None

    return cx, cy, r


# ── METHOD 3: two_stage ──────────────────────────────────────────────

def method_two_stage(image):
    """
    Stage 1 — white_saucer: gets a reliable center from the ceramic.
    Stage 2 — within the saucer ROI, run HoughCircles to find the inner
               cup rim circle (smaller than the saucer, where coffee sits).
    Falls back to the saucer circle if the inner search fails.
    """
    h, w = image.shape[:2]
    min_dim = min(h, w)

    # ── stage 1: saucer ──
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    L   = lab[:, :, 0]
    _, mask = cv2.threshold(L, 175, 255, cv2.THRESH_BINARY)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k, iterations=1)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None
    biggest = max(contours, key=cv2.contourArea)
    (sx, sy), sr = cv2.minEnclosingCircle(biggest)
    if sr < min_dim * 0.08:
        return None

    # ── stage 2: inner cup rim via Hough inside the saucer ROI ──
    pad   = int(sr * 1.05)
    x1    = max(0, int(sx - pad))
    y1    = max(0, int(sy - pad))
    x2    = min(w, int(sx + pad))
    y2    = min(h, int(sy + pad))
    roi   = image[y1:y2, x1:x2]

    roi_small, roi_scale = resize_for_hough(roi, max_dim=600)
    rs, ss = roi_small.shape[:2]

    gray    = cv2.cvtColor(roi_small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 1.5)

    # The cup-rim circle is ~55-85% of the saucer radius
    rmin = int(sr * roi_scale * 0.50)
    rmax = int(sr * roi_scale * 0.88)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=min(rs, ss) // 2,
        param1=80,
        param2=22,
        minRadius=max(5, rmin),
        maxRadius=rmax,
    )

    if circles is not None:
        circles = circles[0]
        # ROI center in ROI-small coords
        roi_cx = (sx - x1) * roi_scale
        roi_cy = (sy - y1) * roi_scale
        roi_center = np.array([roi_cx, roi_cy])

        best = min(circles, key=lambda c: np.linalg.norm(roi_center - c[:2]))
        cx_s, cy_s, r_s = best
        # Back to full image coords
        cx = cx_s / roi_scale + x1
        cy = cy_s / roi_scale + y1
        r  = r_s  / roi_scale
        return cx, cy, r

    # Fallback: return saucer circle
    return sx, sy, sr * 0.82   # scale down saucer r ≈ inner cup radius


# ── METHOD 4: bilateral_hough ────────────────────────────────────────

def method_bilateral_hough(image):
    """
    Bilateral filter on resized image (preserves sharp edges while
    removing texture noise from wood/foam). Then HoughCircles.
    """
    h, w = image.shape[:2]
    small, scale = resize_for_hough(image)
    sh, sw = small.shape[:2]
    small_center = np.array([sw / 2, sh / 2])
    min_dim_s = min(sh, sw)

    gray      = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    bilateral = cv2.bilateralFilter(gray, d=9, sigmaColor=80, sigmaSpace=80)

    circles = cv2.HoughCircles(
        bilateral,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=int(min_dim_s * 0.30),
        param1=60,
        param2=28,
        minRadius=int(min_dim_s * MIN_R_RATIO),
        maxRadius=int(min_dim_s * MAX_R_RATIO),
    )
    if circles is None:
        return None

    circles = circles[0]
    best = min(circles, key=lambda c: np.linalg.norm(small_center - c[:2]))
    cx, cy, r = best / scale
    return cx, cy, r


# ── METHOD 5: bilateral_two_stage ────────────────────────────────────

def method_bilateral_two_stage(image):
    """
    Stage 1 — bilateral_hough on the full image to find the outer
               circle (cup body or saucer).
    Stage 2 — within that ROI, bilateral_hough again at a tighter
               radius range (40-80% of stage-1 radius) to find the
               inner coffee surface edge.
    Falls back to the stage-1 circle if stage 2 finds nothing.
    """
    h, w = image.shape[:2]

    # ── stage 1: outer circle ──
    small, scale = resize_for_hough(image)
    sh, sw = small.shape[:2]
    min_dim_s = min(sh, sw)
    small_center = np.array([sw / 2, sh / 2])

    gray      = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    bilateral = cv2.bilateralFilter(gray, d=9, sigmaColor=80, sigmaSpace=80)

    circles = cv2.HoughCircles(
        bilateral,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=int(min_dim_s * 0.30),
        param1=60,
        param2=28,
        minRadius=int(min_dim_s * MIN_R_RATIO),
        maxRadius=int(min_dim_s * MAX_R_RATIO),
    )
    if circles is None:
        return None

    best_s = min(circles[0], key=lambda c: np.linalg.norm(small_center - c[:2]))
    ox, oy, or_ = best_s / scale   # outer circle in full-image coords

    # ── stage 2: inner coffee circle within the outer ROI ──
    pad = int(or_ * 1.05)
    x1  = max(0, int(ox - pad))
    y1  = max(0, int(oy - pad))
    x2  = min(w, int(ox + pad))
    y2  = min(h, int(oy + pad))
    roi = image[y1:y2, x1:x2]

    roi_small, roi_scale = resize_for_hough(roi, max_dim=600)
    rs, ss = roi_small.shape[:2]

    gray_r = cv2.cvtColor(roi_small, cv2.COLOR_BGR2GRAY)
    bil_r  = cv2.bilateralFilter(gray_r, d=9, sigmaColor=60, sigmaSpace=60)

    # Coffee surface is 40-80% of the outer circle radius
    rmin = max(5, int(or_ * roi_scale * 0.40))
    rmax = int(or_ * roi_scale * 0.80)

    inner = cv2.HoughCircles(
        bil_r,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=min(rs, ss) // 2,
        param1=60,
        param2=20,
        minRadius=rmin,
        maxRadius=rmax,
    )

    if inner is not None:
        roi_cx = (ox - x1) * roi_scale
        roi_cy = (oy - y1) * roi_scale
        roi_center = np.array([roi_cx, roi_cy])
        best_i = min(inner[0], key=lambda c: np.linalg.norm(roi_center - c[:2]))
        cx = best_i[0] / roi_scale + x1
        cy = best_i[1] / roi_scale + y1
        r  = best_i[2] / roi_scale
        return cx, cy, r

    return ox, oy, or_   # fallback: outer circle


# ── EVALUATION ───────────────────────────────────────────────────────

def is_good(cx, cy, r, h, w):
    """Heuristic: is this detection plausible for a coffee cup?"""
    min_dim   = min(h, w)
    img_cx    = w / 2
    img_cy    = h / 2
    dist      = np.hypot(cx - img_cx, cy - img_cy) / min_dim
    r_ratio   = r / min_dim
    return (dist      <= MAX_DIST_RATIO and
            r_ratio   >= MIN_R_RATIO     and
            r_ratio   <= MAX_R_RATIO)


# ── MAIN ─────────────────────────────────────────────────────────────

METHODS = {
    "1_hough_gray":           method_hough_gray,
    "2_white_saucer":         method_white_saucer,
    "3_two_stage":            method_two_stage,
    "4_bilateral_hough":      method_bilateral_hough,
    "5_bilateral_two_stage":  method_bilateral_two_stage,
}

def main():
    files = sorted(f for f in os.listdir(INPUT_FOLDER) if f.lower().endswith(VALID_EXT))
    print(f"Found {len(files)} images\n")

    report = ["COFFEE CROPPER — DETECTION EXPERIMENT REPORT",
              "=" * 64, ""]

    summary = {}   # method -> successes count

    for method_name, method_fn in METHODS.items():
        out_dir = os.path.join(EXP_FOLDER, method_name)
        os.makedirs(out_dir, exist_ok=True)

        report.append(f"METHOD: {method_name}")
        report.append("-" * 48)

        ok_count = 0

        for filename in files:
            filepath = os.path.join(INPUT_FOLDER, filename)
            image    = load(filepath)
            h, w     = image.shape[:2]
            min_dim  = min(h, w)

            try:
                result = method_fn(image)
            except Exception as exc:
                result = None
                report.append(f"  {filename}: ERROR — {exc}")
                debug = draw_none(image, f"ERROR: {exc}")
                cv2.imwrite(os.path.join(out_dir, f"debug_{filename}"), debug)
                continue

            if result is None:
                report.append(f"  {filename}: FAIL — no circle detected")
                debug = draw_none(image)
                cv2.imwrite(os.path.join(out_dir, f"debug_{filename}"), debug)
                continue

            cx, cy, r = result
            good = is_good(cx, cy, r, h, w)

            dist_r  = np.hypot(cx - w/2, cy - h/2) / min_dim
            r_ratio = r / min_dim
            tag     = "OK  " if good else "POOR"

            report.append(
                f"  {filename}: {tag} | "
                f"cx={cx:.0f} cy={cy:.0f} r={r:.0f} | "
                f"dist={dist_r:.2f} r/min={r_ratio:.2f}"
            )

            if good:
                ok_count += 1

            # debug overlay
            color = (0, 200, 80) if good else (0, 100, 255)
            debug = draw_circle(image, cx, cy, r, color=color)
            cv2.imwrite(os.path.join(out_dir, f"debug_{filename}"), debug)

            # crop
            crop = square_crop(image, cx, cy, r)
            cv2.imwrite(os.path.join(out_dir, f"crop_{filename}"), crop)

        summary[method_name] = ok_count
        report.append(f"  -> {ok_count}/{len(files)} images passed\n")

    # ── summary table ──
    report.append("=" * 64)
    report.append("SUMMARY")
    report.append("-" * 40)
    for name, n in summary.items():
        bar  = "#" * n + "." * (len(files) - n)
        report.append(f"  {name:25s}  {bar}  {n}/{len(files)}")

    best = max(summary, key=summary.get)
    report.append("")
    report.append(f"Best method: {best} ({summary[best]}/{len(files)} OK)")
    report.append("=" * 64)

    text = "\n".join(report)
    rpath = os.path.join(EXP_FOLDER, "report.txt")
    with open(rpath, "w", encoding="utf-8") as f:
        f.write(text)

    print(text)
    print(f"\nReport saved -> {rpath}")


if __name__ == "__main__":
    main()

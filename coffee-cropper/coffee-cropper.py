#!/usr/bin/env python3

import os
import cv2
import numpy as np

from PIL import Image
from PIL import ImageOps


# =====================================================
# CONFIGURATION
# =====================================================

INPUT_FOLDER = "input"
OUTPUT_FOLDER = "export"
DEBUG_FOLDER = "debug"

BUFFER_RATIO = 0.15

SAVE_DEBUG_IMAGES = True

VALID_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".tif",
    ".tiff",
)

# =====================================================
# SETUP
# =====================================================

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

if SAVE_DEBUG_IMAGES:
    os.makedirs(DEBUG_FOLDER, exist_ok=True)


# =====================================================
# IMAGE LOADING
# =====================================================

def load_image_correct_orientation(path):
    """
    Load image and apply EXIF orientation correction.
    """

    pil_img = Image.open(path)

    pil_img = ImageOps.exif_transpose(pil_img)

    rgb = np.array(pil_img)

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    return bgr, pil_img


# =====================================================
# COFFEE DETECTION
# =====================================================

WORK_SIZE   = 900
MIN_R_RATIO = 0.12
MAX_R_RATIO = 0.62


def detect_coffee_surface(image):
    """
    Detect the cup/coffee circle via bilateral-filtered HoughCircles.

    Works on both white and brown/dark cups without a saucer anchor.
    Returns (cx, cy, r) in original image coordinates, or None.
    """

    h, w = image.shape[:2]
    scale = WORK_SIZE / max(h, w)
    if scale < 1.0:
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small, scale = image, 1.0

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
        return None, None

    circles = circles[0]
    best = min(circles, key=lambda c: np.linalg.norm(small_center - c[:2]))
    cx, cy, r = best / scale

    return (cx, cy, r), None


# =====================================================
# CROP
# =====================================================

def crop_from_circle(
    image,
    circle,
    buffer_ratio=0.15
):
    """
    Create square crop centered on detected circle.
    """

    cx, cy, r = circle

    half = int(r * (1 + buffer_ratio))

    h, w = image.shape[:2]

    x1 = max(0, int(cx - half))
    y1 = max(0, int(cy - half))
    x2 = min(w, int(cx + half))
    y2 = min(h, int(cy + half))

    return image[y1:y2, x1:x2]


# =====================================================
# DEBUG VISUALIZATION
# =====================================================

def draw_debug(image, circle):

    debug = image.copy()
    cx, cy, r = circle

    cv2.circle(
        debug,
        (int(cx), int(cy)),
        int(r),
        (0, 255, 0),
        3
    )

    cv2.circle(
        debug,
        (int(cx), int(cy)),
        10,
        (0, 0, 255),
        -1
    )

    return debug


# =====================================================
# SAVE METADATA
# =====================================================

def save_with_metadata(
    crop_bgr,
    original_pil,
    output_path
):
    """
    Save crop while preserving metadata.
    """

    crop_rgb = cv2.cvtColor(
        crop_bgr,
        cv2.COLOR_BGR2RGB
    )

    crop_pil = Image.fromarray(
        crop_rgb
    )

    exif_data = original_pil.info.get(
        "exif"
    )

    icc_profile = original_pil.info.get(
        "icc_profile"
    )

    save_kwargs = {
        "quality": 100
    }

    if exif_data:
        save_kwargs["exif"] = exif_data

    if icc_profile:
        save_kwargs["icc_profile"] = icc_profile

    crop_pil.save(
        output_path,
        **save_kwargs
    )


# =====================================================
# PROCESS SINGLE FILE
# =====================================================

def process_image(filepath):

    filename = os.path.basename(filepath)

    print(f"Processing {filename}")

    image, original_pil = (
        load_image_correct_orientation(
            filepath
        )
    )

    circle, mask = (
        detect_coffee_surface(
            image
        )
    )

    if circle is None:
        print(
            f"FAILED: Could not detect coffee surface in {filename}"
        )
        return

    crop = crop_from_circle(
        image,
        circle,
        BUFFER_RATIO
    )

    output_path = os.path.join(
        OUTPUT_FOLDER,
        filename
    )

    save_with_metadata(
        crop,
        original_pil,
        output_path
    )

    if SAVE_DEBUG_IMAGES:

        debug = draw_debug(
            image,
            circle
        )

        debug_path = os.path.join(
            DEBUG_FOLDER,
            filename
        )

        cv2.imwrite(
            debug_path,
            debug
        )

    print(
        f"Saved -> {output_path}"
    )


# =====================================================
# MAIN
# =====================================================

def main():

    files = [
        f
        for f in os.listdir(INPUT_FOLDER)
        if f.lower().endswith(
            VALID_EXTENSIONS
        )
    ]

    print(
        f"Found {len(files)} images"
    )

    for filename in files:

        filepath = os.path.join(
            INPUT_FOLDER,
            filename
        )

        try:

            process_image(
                filepath
            )

        except Exception as e:

            print(
                f"ERROR processing {filename}: {e}"
            )

    print("Done")


if __name__ == "__main__":
    main()
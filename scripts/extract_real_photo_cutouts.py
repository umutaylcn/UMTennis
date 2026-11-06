"""Extract photographed players without synthesizing or repainting pixels.

Requires the project's optional local rembg installation. Source photographs
live in assets/player_sources; only the resulting transparent PNGs are served.
"""

from pathlib import Path
import os
import sys

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage


PROJECT = Path(__file__).resolve().parents[2]
SOURCES = PROJECT / "assets" / "player_sources"
DESTINATIONS = PROJECT / "web" / "public" / "players" / "cutouts"

PHOTOS = {
    # Quentin Halys is intentionally excluded: his Wimbledon 2024 photo uses
    # a manually reviewed cutout; automatic extraction fills the racket with grass.
    "luciano-darderi": ("top40_references/luciano-darderi.jpg", "top40"),
    "daniel-merida-aguilar": ("top60_references/daniel-merida-eurosport2026.jpg", "top60"),
    "casper-ruud": ("top20_references/casper-ruud-us-open-2023.jpg", "top20"),
    "tomas-machac": ("top40_references/tomas-machac-alternate.jpg", "top40"),
    "alejandro-davidovich-fokina": ("top40_references/alejandro-davidovich-fokina.jpg", "top40"),
    "matteo-berrettini": ("top40_references/matteo-berrettini.jpg", "top40"),
    "andrey-rublev": ("top40_references/rublev-usopen-03.jpg", "top40"),
    "stefanos-tsitsipas": ("top40_references/stefanos-tsitsipas-rome2023-proxy.jpg", "top40"),
}


def extract(source: Path, session: object) -> Image.Image:
    original = Image.open(source).convert("RGB")
    segmented = remove(original, session=session).convert("RGBA")
    # rembg contributes only its alpha mask. Every visible RGB pixel is from
    # the authentic photograph, never from a generated/reconstructed image.
    alpha = segmented.getchannel("A")
    if alpha.getbbox() is None:
        raise ValueError(f"Empty segmentation: {source}")
    alpha_array = np.asarray(alpha).copy()
    if source.name == "stefanos-tsitsipas-rome2023-proxy.jpg":
        # The automated mask also selects a court line behind his left side.
        # This rectangle contains no part of the photographed player or racket.
        alpha_array[330:365, :720] = 0
    labels, count = ndimage.label(alpha_array > 128, structure=np.ones((3, 3)))
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        subject = labels == sizes.argmax()
        # Remove detached background people/signage while preserving a soft edge.
        if source.name != "stefanos-tsitsipas-rome2023-proxy.jpg":
            subject = ndimage.binary_fill_holes(subject)
        refined_alpha = np.minimum(alpha_array, ndimage.gaussian_filter(subject.astype(np.float32), 0.65) * 255)
        alpha = Image.fromarray(refined_alpha.astype(np.uint8), "L")
    output = original.convert("RGBA")
    output.putalpha(alpha)
    return output


def normalize(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("No visible subject")
    subject = image.crop(bbox)
    scale = min(984 / subject.width, 1496 / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (1024, 1536), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((1024 - subject.width) // 2, 1536 - subject.height - 12))
    return canvas


def clean_clay_fringe(image: Image.Image) -> Image.Image:
    """Decontaminate red clay in the thin outer RGB edge without cutting alpha."""
    pixels = np.asarray(image).copy()
    alpha = pixels[:, :, 3]
    visible = alpha > 0
    edge_depth = ndimage.distance_transform_edt(visible)
    core = (edge_depth >= 20) & (alpha >= 220)
    distance, nearest = ndimage.distance_transform_edt(~core, return_indices=True)
    interior = pixels[nearest[0], nearest[1], :3].astype(np.float32)
    rgb = pixels[:, :, :3].astype(np.float32)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    clay_spill = (
        visible
        & (edge_depth <= 16)
        & (distance <= 25)
        & (red > 120)
        & (red > green * 1.12)
        & (green > blue * 1.02)
    )
    strength = np.clip((17 - edge_depth) / 7, 0, 1)
    blended = rgb * (1 - strength[:, :, None]) + interior * strength[:, :, None]
    pixels[:, :, :3][clay_spill] = np.clip(blended[clay_spill], 0, 255).astype(np.uint8)
    # The original clay spill penetrates several pixels into the mask. A
    # two-pixel trim still leaves a conspicuous red outline at website size.
    # Trim only clay-coloured edge pixels, never an entire silhouette band.
    pixels[:, :, 3][clay_spill & (edge_depth <= 8)] = 0
    return Image.fromarray(pixels, "RGBA")


def clear_tsitsipas_clay_gap(image: Image.Image) -> Image.Image:
    """Clear clay erroneously kept between the photographed sleeve and torso."""
    pixels = np.asarray(image).copy()
    region = pixels[480:600, 225:385]
    red = region[:, :, 0].astype(np.float32)
    green = region[:, :, 1].astype(np.float32)
    blue = region[:, :, 2].astype(np.float32)
    clay = (
        (region[:, :, 3] > 0)
        & (red > 130)
        & (red > green * 1.32)
        & (green > blue * 1.1)
        & (blue < 110)
    )
    labels, count = ndimage.label(clay)
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        gap = ndimage.binary_dilation(labels == sizes.argmax(), iterations=2)
        region[:, :, 3][gap] = 0
    return Image.fromarray(pixels, "RGBA")


def main(slugs: list[str]) -> None:
    requested = slugs or list(PHOTOS)
    unknown = set(requested) - PHOTOS.keys()
    if unknown:
        raise ValueError(f"Unknown player(s): {', '.join(sorted(unknown))}")
    session = new_session(os.environ.get("CUTOUT_MODEL", "isnet-general-use"))
    for slug in requested:
        source_name, group = PHOTOS[slug]
        source = SOURCES / source_name
        if not source.is_file():
            raise FileNotFoundError(source)
        output = normalize(extract(source, session))
        if slug == "stefanos-tsitsipas":
            output = clear_tsitsipas_clay_gap(output)
        if slug in {"alejandro-davidovich-fokina", "stefanos-tsitsipas"}:
            output = clean_clay_fringe(output)
        destination = DESTINATIONS / group / f"{slug}.png"
        output.save(destination, optimize=True)
        alpha = np.asarray(output.getchannel("A"))
        print(f"{slug}: {source_name} -> {destination} ({np.count_nonzero(alpha) / alpha.size:.1%} opaque area)")


if __name__ == "__main__":
    main(sys.argv[1:])

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
    "luciano-darderi": ("top40_references/luciano-darderi.jpg", "top40"),
    "daniel-merida-aguilar": ("top60_references/daniel-merida-eurosport2026.jpg", "top60"),
    "casper-ruud": ("top20_references/casper-ruud.jpg", "top20"),
    "tomas-machac": ("top40_references/tomas-machac-alternate.jpg", "top40"),
    "alejandro-davidovich-fokina": ("top40_references/alejandro-davidovich-fokina.jpg", "top40"),
    "quentin-halys": ("top40_references/quentin-halys.jpg", "top40"),
    "matteo-berrettini": ("top40_references/matteo-berrettini.jpg", "top40"),
    "andrey-rublev": ("top40_references/rublev-usopen-03.jpg", "top40"),
    "stefanos-tsitsipas": ("top40_references/stefanos-tsitsipas-indianwells2025.jpg", "top40"),
}


def extract(source: Path, session: object) -> Image.Image:
    original = Image.open(source).convert("RGB")
    segmented = remove(original, session=session).convert("RGBA")
    # rembg contributes only its alpha mask. Every visible RGB pixel is from
    # the authentic photograph, never from a generated/reconstructed image.
    alpha = segmented.getchannel("A")
    if alpha.getbbox() is None:
        raise ValueError(f"Empty segmentation: {source}")
    alpha_array = np.asarray(alpha)
    labels, count = ndimage.label(alpha_array > 128, structure=np.ones((3, 3)))
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        subject = labels == sizes.argmax()
        # Remove detached background people/signage while preserving a soft edge.
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
    """Drop clay-coloured antialias pixels at the cutout edge, without repainting."""
    pixels = np.asarray(image).copy()
    alpha = pixels[:, :, 3]
    edge_depth = ndimage.distance_transform_edt(alpha > 0)
    red = pixels[:, :, 0].astype(np.float32)
    green = pixels[:, :, 1].astype(np.float32)
    blue = pixels[:, :, 2].astype(np.float32)
    clay_spill = (
        (alpha > 0)
        & (edge_depth <= 8)
        & (red > 110)
        & (red > green * 1.3)
        & (green > blue * 1.05)
    )
    pixels[:, :, 3][clay_spill] = 0
    # A narrow second trim removes source-photo colour bleeding that survives
    # the hue check (notably around dark shoes and the racket frame).
    pixels[:, :, 3] = ndimage.grey_erosion(pixels[:, :, 3], size=(5, 5))
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
        if slug in {"alejandro-davidovich-fokina", "quentin-halys"}:
            output = clean_clay_fringe(output)
        destination = DESTINATIONS / group / f"{slug}.png"
        output.save(destination, optimize=True)
        alpha = np.asarray(output.getchannel("A"))
        print(f"{slug}: {source_name} -> {destination} ({np.count_nonzero(alpha) / alpha.size:.1%} opaque area)")


if __name__ == "__main__":
    main(sys.argv[1:])

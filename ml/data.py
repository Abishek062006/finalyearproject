"""
Saliency4ASD (Duan et al., ACM MMSys 2019; Gutiérrez et al., SPIC 2021):
300 natural images (from MIT1003), each viewed for 3 s by 14 autistic (ASD)
and 14 typically developing (TD) children aged 5-12.

This module loads it once into a small cache at training resolution, and
gives evaluation access to the original-resolution maps. The dataset itself
lives in datasets/saliency4asd/ (git-ignored: its licence forbids sharing).
"""
import csv
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / "datasets" / "saliency4asd"
CACHE = Path(__file__).resolve().parent / "cache"
TRAIN_HW = (240, 320)  # training resolution (H, W)
GROUPS = ("ASD", "TD")


def image_ids() -> list[int]:
    return sorted(int(p.stem) for p in (ROOT / "TrainingData" / "Images").glob("*.png"))


def load_image(i: int) -> np.ndarray:
    return cv2.cvtColor(cv2.imread(str(ROOT / "TrainingData" / "Images" / f"{i}.png")), cv2.COLOR_BGR2RGB)


def load_density(i: int, group: str) -> np.ndarray:
    """Fixation density map (fixations blurred with a 1° Gaussian), float in [0,1], original size."""
    return cv2.imread(str(ROOT / "TrainingData" / f"{group}_FixMaps" / f"{i}_s.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0


def load_fixations(i: int, group: str) -> np.ndarray:
    """Binary map of the actual fixation points, original size."""
    return cv2.imread(str(ROOT / "AdditionalData" / f"{group}_FixPts" / f"{i}_f.png"), cv2.IMREAD_GRAYSCALE) > 0


@dataclass
class Box:
    image: int
    x1: int
    y1: int
    x2: int
    y2: int
    label: str


def load_boxes() -> list[Box]:
    """Object annotations shipped with the dataset (face, people, animal, object, car, food…)."""
    out = []
    for row in csv.reader(open(ROOT / "AdditionalData" / "ImageAnnotations.csv")):
        if len(row) < 6:
            continue
        x1, y1, x2, y2 = (int(float(v)) for v in row[1:5])
        out.append(Box(int(Path(row[0]).stem), min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2), row[5].strip()))
    return out


def _downsample_points(fix: np.ndarray, hw: tuple[int, int]) -> np.ndarray:
    out = np.zeros(hw, dtype=bool)
    ys, xs = np.nonzero(fix)
    if len(ys):
        out[(ys * hw[0] / fix.shape[0]).astype(int).clip(0, hw[0] - 1), (xs * hw[1] / fix.shape[1]).astype(int).clip(0, hw[1] - 1)] = True
    return out


def training_arrays() -> dict[str, np.ndarray]:
    """All 300 images and both groups' maps at TRAIN_HW, cached after the first call."""
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"s4asd_{TRAIN_HW[0]}x{TRAIN_HW[1]}.npz"
    if path.exists():
        return dict(np.load(path))
    ids = image_ids()
    h, w = TRAIN_HW
    data = {"ids": np.array(ids), "images": np.zeros((len(ids), h, w, 3), np.uint8)}
    for g in GROUPS:
        data[f"{g}_density"] = np.zeros((len(ids), h, w), np.float32)
        data[f"{g}_fix"] = np.zeros((len(ids), h, w), bool)
    for k, i in enumerate(ids):
        data["images"][k] = cv2.resize(load_image(i), (w, h), interpolation=cv2.INTER_AREA)
        for g in GROUPS:
            data[f"{g}_density"][k] = cv2.resize(load_density(i, g), (w, h), interpolation=cv2.INTER_AREA)
            data[f"{g}_fix"][k] = _downsample_points(load_fixations(i, g), (h, w))
    np.savez_compressed(path, **data)
    return data


def folds(n: int, k: int = 5, seed: int = 0) -> list[np.ndarray]:
    """k disjoint test folds over image indices (fixed seed: every model is tested on the same splits)."""
    order = np.random.default_rng(seed).permutation(n)
    return [order[f::k] for f in range(k)]

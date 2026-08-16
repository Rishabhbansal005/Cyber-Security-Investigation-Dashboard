"""Build a local ImageFolder subset for AI vs real training.

Primary source (Hugging Face, no Kaggle key):
  Rajarshi-Roy-research/Defactify_Image_Dataset
  Real MS-COCO photos vs SD 2.1 / SDXL / SD3 / DALL-E 3 / Midjourney v6.

Midjourney is held out of train (used in test) so the lab score is not
only "saw this generator already". ChatGPT / Flux images are still
out-of-distribution — keep a few of those for a manual check after training.

Writes:
  C:\\Users\\asus_pc\\datasets\\image_auth_ai_subset\\
    train|val|test / authentic|generated / *.jpg

Do not git this folder.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

from PIL import Image

OUT = Path(r"C:\Users\asus_pc\datasets\image_auth_ai_subset")
SEED = 42
# Fit RTX 4050 6GB / same budget as the GAN run
TRAIN_N = 8000
VAL_N = 1500
TEST_N = 1500

# Label_B names we expect from Defactify (string or int)
HOLD_OUT_TRAIN = {"midjourney", "5"}  # test-only generator
TRAIN_AI_SOURCES = {"sd21", "sdxl", "sd3", "dalle3", "1", "2", "3", "4"}


def _label_a(ex) -> int | None:
    v = ex.get("Label_A", ex.get("label_a", ex.get("label")))
    if v is None:
        return None
    if isinstance(v, str):
        s = v.lower().replace("-", "").replace("_", "").replace(" ", "")
        if s in ("real", "authentic", "0"):
            return 0
        if s in ("aigenerated", "fake", "generated", "1"):
            return 1
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _label_b(ex) -> str:
    v = ex.get("Label_B", ex.get("label_b", ex.get("generator", "")))
    if v is None:
        return ""
    if isinstance(v, int):
        return str(v)
    return str(v).lower().replace(" ", "").replace("-", "").replace("_", "")


def _to_pil(ex) -> Image.Image | None:
    img = ex.get("Image") or ex.get("image")
    if img is None:
        return None
    if isinstance(img, Image.Image):
        return img.convert("RGB")
    arr = getattr(img, "convert", None)
    if callable(arr):
        return img.convert("RGB")
    return None


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, format="JPEG", quality=92)


def download_defactify(out: Path) -> bool:
    from datasets import load_dataset

    print("Loading Defactify_Image_Dataset (streaming)…")
    ds = load_dataset(
        "Rajarshi-Roy-research/Defactify_Image_Dataset",
        split="train",
        streaming=True,
    )
    random.seed(SEED)
    need = {
        "train": {"authentic": TRAIN_N, "generated": TRAIN_N},
        "val": {"authentic": VAL_N, "generated": VAL_N},
        "test": {"authentic": TEST_N, "generated": TEST_N},
    }
    have = {s: {"authentic": 0, "generated": 0} for s in need}
    n_skip_hold = 0
    n_seen = 0

    def remaining() -> int:
        return sum(need[s][c] - have[s][c] for s in need for c in need[s])

    for ex in ds:
        n_seen += 1
        if remaining() <= 0:
            break
        y = _label_a(ex)
        if y is None:
            continue
        img = _to_pil(ex)
        if img is None:
            continue
        src = _label_b(ex)
        is_hold = any(h in src for h in ("midjourney",)) or src == "5"

        if y == 0:
            cls = "authentic"
            # real photos: fill train, then val, then test
            split = None
            for s in ("train", "val", "test"):
                if have[s][cls] < need[s][cls]:
                    split = s
                    break
        else:
            cls = "generated"
            if is_hold:
                # hold Midjourney out of train
                if have["test"][cls] < need["test"][cls]:
                    split = "test"
                elif have["val"][cls] < need["val"][cls] // 3:
                    split = "val"
                else:
                    n_skip_hold += 1
                    continue
            else:
                split = None
                for s in ("train", "val", "test"):
                    if s == "test" and have["test"][cls] >= need["test"][cls] * 2 // 3:
                        # keep ~1/3 of test slots for hold-out Midjourney
                        continue
                    if have[s][cls] < need[s][cls]:
                        split = s
                        break
                if split is None:
                    continue

        if split is None:
            continue
        idx = have[split][cls]
        _save(img, out / split / cls / f"{split}_{cls}_{idx:05d}.jpg")
        have[split][cls] += 1
        if n_seen % 200 == 0:
            print(
                f"  seen={n_seen} train={have['train']} val={have['val']} "
                f"test={have['test']} remain={remaining()}"
            )

    print("Defactify subset counts:", have, "skipped extra Midjourney", n_skip_hold)
    ok = all(have[s][c] >= int(need[s][c] * 0.8) for s in need for c in need[s])
    if not ok:
        print("Train stream incomplete — will top up from validation/test splits.")
    return ok


def download_julienlucas(out: Path) -> bool:
    """Fallback ~2.5k+2.5k train — smaller but still Midjourney/DALL-E/SD."""
    from datasets import load_dataset

    print("Fallback: julienlucas/midjourney-dalle-sd-dataset")
    ds = load_dataset("julienlucas/midjourney-dalle-sd-dataset")
    random.seed(SEED)

    def dump(split_name: str, dest_split: str, max_per: int) -> None:
        rows = list(ds[split_name])
        random.shuffle(rows)
        counts = {"authentic": 0, "generated": 0}
        for i, ex in enumerate(rows):
            lab = ex.get("label")
            if isinstance(lab, int):
                cls = "authentic" if lab == 0 else "generated"
            else:
                s = str(lab).lower()
                cls = "authentic" if s in ("real", "authentic", "0") else "generated"
            if counts[cls] >= max_per:
                continue
            img = _to_pil(ex)
            if img is None:
                continue
            _save(img, out / dest_split / cls / f"{dest_split}_{cls}_{counts[cls]:05d}.jpg")
            counts[cls] += 1
        print(f"  {dest_split} from {split_name}: {counts}")

    dump("train", "train", TRAIN_N)
    # their test → split into val/test
    rows = list(ds["test"])
    random.shuffle(rows)
    counts = {
        "val": {"authentic": 0, "generated": 0},
        "test": {"authentic": 0, "generated": 0},
    }
    for ex in rows:
        lab = ex.get("label")
        if isinstance(lab, int):
            cls = "authentic" if lab == 0 else "generated"
        else:
            s = str(lab).lower()
            cls = "authentic" if s in ("real", "authentic", "0") else "generated"
        split = "val" if counts["val"][cls] < VAL_N else "test"
        if counts[split][cls] >= (VAL_N if split == "val" else TEST_N):
            continue
        img = _to_pil(ex)
        if img is None:
            continue
        n = counts[split][cls]
        _save(img, out / split / cls / f"{split}_{cls}_{n:05d}.jpg")
        counts[split][cls] += 1
    print("  val/test:", counts)
    train_ok = (out / "train" / "authentic").exists() and (out / "train" / "generated").exists()
    return train_ok


def _count(out: Path, split: str, cls: str) -> int:
    d = out / split / cls
    if not d.is_dir():
        return 0
    return sum(1 for p in d.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})


def fill_from_split(out: Path, hf_split: str, dest_split: str, cls: str, need: int) -> int:
    from datasets import load_dataset

    have = _count(out, dest_split, cls)
    if have >= need:
        print(f"  {dest_split}/{cls} already {have}")
        return have
    print(f"Filling {dest_split}/{cls} from HF split={hf_split} (have {have}, need {need})")
    ds = load_dataset(
        "Rajarshi-Roy-research/Defactify_Image_Dataset",
        split=hf_split,
        streaming=True,
    )
    want_y = 0 if cls == "authentic" else 1
    for ex in ds:
        if have >= need:
            break
        if _label_a(ex) != want_y:
            continue
        img = _to_pil(ex)
        if img is None:
            continue
        _save(img, out / dest_split / cls / f"{dest_split}_{cls}_{have:05d}.jpg")
        have += 1
        if have % 200 == 0:
            print(f"  {dest_split}/{cls}={have}")
    print(f"  done {dest_split}/{cls}={have}")
    return have


def resume_defactify(out: Path) -> bool:
    if _count(out, "train", "authentic") < int(TRAIN_N * 0.8):
        fill_from_split(out, "validation", "train", "authentic", TRAIN_N)
    else:
        print(f"  train/authentic already {_count(out, 'train', 'authentic')} (enough to train)")
    fill_from_split(out, "validation", "val", "authentic", VAL_N)
    fill_from_split(out, "test", "test", "authentic", TEST_N)
    if _count(out, "val", "authentic") < VAL_N:
        fill_from_split(out, "test", "val", "authentic", VAL_N)
    have = {
        s: {"authentic": _count(out, s, "authentic"), "generated": _count(out, s, "generated")}
        for s in ("train", "val", "test")
    }
    print("subset counts:", have)
    return (
        have["train"]["authentic"] >= int(TRAIN_N * 0.8)
        and have["train"]["generated"] >= int(TRAIN_N * 0.8)
        and have["val"]["authentic"] >= 200
        and have["val"]["generated"] >= 200
        and have["test"]["authentic"] >= 200
        and have["test"]["generated"] >= 200
    )


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    out.mkdir(parents=True, exist_ok=True)
    have_train = _count(out, "train", "generated")
    if have_train < 1000:
        try:
            ok = download_defactify(out)
        except Exception as exc:
            print("Defactify train stream failed:", exc)
            ok = False
    else:
        print("Resuming existing subset (train generated already present).")
        ok = False
    if not ok:
        ok = resume_defactify(out)
    if not ok:
        try:
            ok = download_julienlucas(out)
        except Exception as exc:
            print("julienlucas fallback failed:", exc)
            ok = False
    if not ok:
        raise SystemExit("Could not build a usable subset.")
    print(f"Wrote {out}")
    print("Next: python -m ml.image_auth_ai.train")


if __name__ == "__main__":
    main()

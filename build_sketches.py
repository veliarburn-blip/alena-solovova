"""Пересборка эскизов для hero-конвейера.

Как пользоваться:
  1. Положи/замени файлы в папке `рисунки/` (jpg, jpeg, png, webp).
  2. Запусти:  python build_sketches.py
Скрипт пережмёт их в `assets/img/sketches/*.webp` и обновит список
`assets/js/sketches.js`, который читает сайт. Правки в HTML/JS не нужны.
"""
from __future__ import annotations

import glob
import json
import os

from PIL import Image, ImageOps

SRC_DIR = "рисунки"
OUT_DIR = "assets/img/sketches"
LIST_JS = "assets/js/sketches.js"
MAX_SIDE = 820          # длинная сторона, px
QUALITY = 80
EXTS = (".jpg", ".jpeg", ".png", ".webp")


def sources() -> list[str]:
    files: list[str] = []
    for ext in EXTS:
        files += glob.glob(os.path.join(SRC_DIR, f"*{ext}"))
        files += glob.glob(os.path.join(SRC_DIR, f"*{ext.upper()}"))
    return sorted(set(files))


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for old in glob.glob(os.path.join(OUT_DIR, "*.webp")):
        os.remove(old)

    names: list[str] = []
    for path in sources():
        im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        w, h = im.size
        scale = min(1.0, MAX_SIDE / max(w, h))
        if scale < 1.0:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        name = os.path.splitext(os.path.basename(path))[0] + ".webp"
        im.save(os.path.join(OUT_DIR, name), "WEBP", quality=QUALITY, method=6)
        names.append(name)

    with open(LIST_JS, "w", encoding="utf-8") as f:
        f.write("/* Автогенерация build_sketches.py — вручную не править. */\n")
        f.write("window.HERO_SKETCHES = " + json.dumps(names, ensure_ascii=False, indent=2) + ";\n")

    total = sum(os.path.getsize(os.path.join(OUT_DIR, n)) for n in names)
    print(f"Готово: {len(names)} эскизов, {total/1024/1024:.2f} МБ -> {OUT_DIR}")
    print(f"Список обновлён: {LIST_JS}")


if __name__ == "__main__":
    main()

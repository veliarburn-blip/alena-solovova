"""Сборка блока «Портфолио».

Как пользоваться:
  1. Одна работа = одна папка в `портфолио/`, например `портфолио/01-kostyumy/`.
     Порядок на сайте — по имени папки (поэтому номер в начале). Имя папки — латиницей.
  2. В папке:
       info.txt          — описание работы (формат ниже);
       лекало*.jpg       — фото/сканы лекал (всё, что начинается с «лекало»);
       остальные фото    — готовое изделие; первое по имени станет обложкой.
  3. Запусти:  python build_portfolio.py
Скрипт пережмёт фото в `assets/img/works/<папка>/` и обновит
`assets/js/portfolio-data.js`, который читает сайт. Правки в HTML/JS не нужны.

Формат info.txt (пустые строки и незаполненные поля просто не показываются):
  Категория: Костюмы
  Название: Мужской костюм
  Описание: Пара предложений о работе.
  Материал: костюмная шерсть
  Размер: 50 / 182
  Что сделано: конструкция · лекала · пошив
  Для кого: частный заказ
  Фото из: рисунки        (необязательно — взять фото изделия из другой папки проекта)
"""
from __future__ import annotations

import json
import os
import re
import shutil

from PIL import Image, ImageOps

SRC_DIR = "портфолио"
OUT_DIR = "assets/img/works"
DATA_JS = "assets/js/portfolio-data.js"
MAX_SIDE = 1600         # длинная сторона основного фото, px
THUMB_SIDE = 480        # длинная сторона миниатюры, px
QUALITY = 82
EXTS = (".jpg", ".jpeg", ".png", ".webp")
PATTERN_PREFIX = "лекало"
INFO_FILE = "info.txt"

# ключ в info.txt -> поле в portfolio-data.js
FIELDS: dict[str, str] = {
    "категория": "cat",
    "название": "title",
    "описание": "desc",
    "материал": "fabric",
    "размер": "size",
    "что сделано": "work",
    "для кого": "client",
    "фото из": "from",
}
KEY_RE = re.compile(r"^\s*([^:]+?)\s*:\s*(.*)$")


def read_info(path: str) -> dict[str, str]:
    info: dict[str, str] = {}
    last: str | None = None
    if not os.path.exists(path):
        return info
    with open(path, encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.rstrip()
            m = KEY_RE.match(line)
            key = FIELDS.get(m.group(1).lower()) if m else None
            if key:
                info[key] = m.group(2).strip()
                last = key
            elif line.strip() and last:
                # строка без ключа — продолжение предыдущего поля (длинное описание)
                info[last] = (info[last] + " " + line.strip()).strip()
    return {k: v for k, v in info.items() if v}


def images_in(folder: str) -> list[str]:
    names: list[str] = [
        n for n in os.listdir(folder)
        if n.lower().endswith(EXTS + (".svg",)) and os.path.isfile(os.path.join(folder, n))
    ]
    return [os.path.join(folder, n) for n in sorted(names, key=str.lower)]


def export(src: str, out_dir: str, stem: str) -> tuple[str, str]:
    """Возвращает (основное фото, миниатюра) — пути относительно корня сайта."""
    if src.lower().endswith(".svg"):
        dst = os.path.join(out_dir, stem + ".svg")
        shutil.copyfile(src, dst)
        return dst, dst

    im = ImageOps.exif_transpose(Image.open(src))
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    paths: list[str] = []
    for suffix, side in (("", MAX_SIDE), ("-thumb", THUMB_SIDE)):
        copy = im.copy()
        copy.thumbnail((side, side), Image.LANCZOS)
        dst = os.path.join(out_dir, f"{stem}{suffix}.webp")
        copy.save(dst, "WEBP", quality=QUALITY, method=6)
        paths.append(dst)
    return paths[0], paths[1]


def web(path: str) -> str:
    return path.replace(os.sep, "/")


def build_work(folder: str) -> dict[str, object] | None:
    slug: str = os.path.basename(folder)
    info: dict[str, str] = read_info(os.path.join(folder, INFO_FILE))
    sources: list[str] = images_in(folder)
    if "from" in info:
        sources += images_in(info.pop("from"))
    if not sources:
        print(f"  пропуск {slug}: нет фото")
        return None

    out_dir = os.path.join(OUT_DIR, slug)
    os.makedirs(out_dir, exist_ok=True)

    pattern: list[str] = []
    photos: list[str] = []
    thumbs: list[str] = []
    for i, src in enumerate(sources, 1):
        is_pattern = os.path.basename(src).lower().startswith(PATTERN_PREFIX)
        full, thumb = export(src, out_dir, f"{'pattern' if is_pattern else 'photo'}-{i:02d}")
        (pattern if is_pattern else photos).append(web(full))
        if not is_pattern:
            thumbs.append(web(thumb))

    work: dict[str, object] = {"id": slug, **info, "pattern": pattern, "photos": photos}
    work["thumb"] = thumbs[0] if thumbs else pattern[0]
    print(f"  {slug}: лекал {len(pattern)}, фото {len(photos)}")
    return work


def main() -> None:
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)

    folders: list[str] = sorted(
        (os.path.join(SRC_DIR, n) for n in os.listdir(SRC_DIR)
         if os.path.isdir(os.path.join(SRC_DIR, n))),
        key=str.lower,
    )
    works: list[dict[str, object]] = [w for f in folders if (w := build_work(f))]

    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("/* Автогенерация build_portfolio.py — вручную не править. */\n")
        f.write("window.PORTFOLIO = " + json.dumps(works, ensure_ascii=False, indent=2) + ";\n")

    total = sum(
        os.path.getsize(os.path.join(root, n))
        for root, _, names in os.walk(OUT_DIR) for n in names
    )
    print(f"Готово: {len(works)} работ, {total / 1024 / 1024:.2f} МБ -> {OUT_DIR}")
    print(f"Список обновлён: {DATA_JS}")


if __name__ == "__main__":
    main()

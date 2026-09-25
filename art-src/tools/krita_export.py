"""Suture & Steel — Krita export script (ART-0042).

Run from Krita's Scripter (Tools ▸ Scripts ▸ Scripter), or add it as an action. It exports the
active document the same way for every artist:

  * flattened, 8-bit sRGB RGBA PNG (no colour profile surprises; the pipeline assumes sRGB, ART-0049)
  * at the master resolution (no resizing here: `npm run art:export` makes the ship size)
  * into art-src/export/<category>/…, named from the document per the naming rule (ART-0031):
    lowercase kebab-case subject-variant-state with an optional @2x suffix
  * sprite frames: every top-level layer whose name starts with "frame:" is exported on its own
    (other layers hidden), e.g. "frame: splatter-5" → sprites/<sheet>/splatter-5.png

Set CATEGORY (and SHEET for sprites) below, or name the document "<category>--<name>.kra"
(e.g. "backdrops--ch1-hospice-ward-night.kra", "sprites-fx--splatter-5.kra").
Then run `npm run art:export` in the repository to produce the shipped files and manifest.
"""
import os
import re

from krita import InfoObject, Krita  # type: ignore

# ---- settings (leave empty to take them from the document name) --------------------------------
CATEGORY = ""  # backdrops | portraits | sprites | ui | luts
SHEET = ""  # sprites only: the sheet folder, e.g. "fx"
REPO = ""  # path to the repository; empty = walk up from the document to find art-src/

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*(@[1-4]x)?$")
CATEGORIES = {"backdrops", "portraits", "sprites", "ui", "luts"}


def kebab(s):
    s = re.sub(r"[^A-Za-z0-9@]+", "-", s.strip()).strip("-").lower()
    return re.sub(r"-+", "-", s)


def find_repo(start):
    d = os.path.dirname(os.path.abspath(start))
    while d and d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "art-src")) and os.path.isfile(os.path.join(d, "package.json")):
            return d
        d = os.path.dirname(d)
    raise RuntimeError("Could not find the repository (a folder holding art-src/ and package.json). Set REPO.")


def target(doc):
    base = os.path.splitext(os.path.basename(doc.fileName() or doc.name()))[0]
    category, sheet, name = CATEGORY, SHEET, base
    m = re.match(r"^([a-z]+)(?:-([a-z0-9]+))?--(.+)$", base)
    if m:
        category = category or m.group(1)
        sheet = sheet or (m.group(2) or "")
        name = m.group(3)
    name = kebab(name)
    if category not in CATEGORIES:
        raise RuntimeError(f"Unknown category {category!r}: set CATEGORY or name the file <category>--<name>.kra")
    if category == "sprites" and not sheet:
        raise RuntimeError("Sprites need a sheet: set SHEET or name the file sprites-<sheet>--<name>.kra")
    if not NAME_RE.match(name):
        raise RuntimeError(f"{name!r} breaks the naming rule (lowercase kebab-case, optional @2x)")
    repo = REPO or find_repo(doc.fileName())
    folder = os.path.join(repo, "art-src", "export", category, *( [sheet] if sheet else [] ))
    os.makedirs(folder, exist_ok=True)
    return folder, name


def png_options():
    o = InfoObject()
    o.setProperty("alpha", True)
    o.setProperty("compression", 6)
    o.setProperty("forceSRGB", True)
    o.setProperty("indexed", False)
    o.setProperty("interlaced", False)
    o.setProperty("saveSRGBProfile", False)
    o.setProperty("transparencyFillcolor", [0, 0, 0])
    return o


def export(doc, path):
    doc.setBatchmode(True)
    try:
        if not doc.exportImage(path, png_options()):
            raise RuntimeError(f"Krita could not write {path}")
    finally:
        doc.setBatchmode(False)
    print("exported", path)


def main():
    app = Krita.instance()
    doc = app.activeDocument()
    if doc is None:
        raise RuntimeError("Open the master document first.")
    if doc.colorModel() != "RGBA" or doc.colorDepth() != "U8":
        doc.setColorSpace("RGBA", "U8", "sRGB-elle-V2-srgbtrc.icc")
    folder, name = target(doc)
    frames = [n for n in doc.topLevelNodes() if n.name().lower().startswith("frame:")]
    if not frames:
        export(doc, os.path.join(folder, name + ".png"))
        return
    visible = {n.name(): n.visible() for n in doc.topLevelNodes()}
    try:
        for f in frames:
            for n in doc.topLevelNodes():
                n.setVisible(n == f or not n.name().lower().startswith("frame:"))
            doc.refreshProjection()
            frame = kebab(f.name().split(":", 1)[1])
            if not NAME_RE.match(frame):
                raise RuntimeError(f"Frame layer {f.name()!r} breaks the naming rule")
            export(doc, os.path.join(folder, frame + ".png"))
    finally:
        for n in doc.topLevelNodes():
            n.setVisible(visible.get(n.name(), True))
        doc.refreshProjection()


main()

#!/usr/bin/env python3
"""Compare every text line in an SVG with the same line in the source screenshot.

Usage: check_text_fit.py design.svg screenshot.png [--scale 1] [--hinted]

For each <text> (or each positioned <tspan> line) it renders that line alone,
measures its ink box, measures the ink in the screenshot over the same band,
and reports start-x offset, width ratio and a suggested fix:
  - mixed-case text   -> suggested font-size (size * width ratio)
  - letter-spaced text -> suggested letter-spacing
Lines within ~2% / 2px are reported as OK.

The render finds where each line sits, but its width is hinted: cairo rounds
glyph advances to whole pixels, which skews widths by several percent at UI
sizes. So the expected width comes from the font file's own advance widths and
outlines instead, unhinted as browsers and Figma lay text out (no kerning,
matching cairosvg). Lines that mix fonts, or whose font isn't in ~/.fonts, fall
back to the render's width and are marked "(render)". --hinted uses the render's
width for every line, as before. (cairosvg's text-rendering="geometricPrecision"
would unhint the render itself, but cairo 1.18 scrambles glyphs that way at 1x.)

Needs: cairosvg, fonttools, pillow, numpy and the design's fonts as static files
in ~/.fonts with fc-cache -f run; setup.sh does this.
"""
import argparse, copy, glob, io, os, re, sys
import xml.etree.ElementTree as ET
import numpy as np
import cairosvg
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from PIL import Image

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
T = lambda tag: f"{{{NS}}}{tag}"


def ink_box(arr, bg, thr=60):
    """Bounding box of pixels differing from bg by more than thr (sum of RGB)."""
    diff = np.abs(arr.astype(int) - np.array(bg, int)).sum(-1) > thr
    ys, xs = np.nonzero(diff)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max(), diff


def render(tree, w, h):
    png = cairosvg.svg2png(bytestring=ET.tostring(tree.getroot()), output_width=w, output_height=h, background_color="white")
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGB"))


def attr(el, name, parent=None, default=None):
    v = el.get(name)
    if v is None and parent is not None:
        v = parent.get(name)
    return v if v is not None else default


SHAPES = tuple(T(s) for s in ("rect", "path", "line", "circle", "ellipse", "polygon", "polyline"))
WEIGHT_STYLE = {100: "Thin", 200: "ExtraLight", 300: "Light", 500: "Medium", 600: "SemiBold", 800: "ExtraBold", 900: "Black"}


def installed_fonts():
    """The fonts in ~/.fonts, where setup.sh puts them: their family names (name
    ID 1, which fontconfig matches), and a map from (typographic family, weight,
    italic) to file."""
    names, files = set(), {}
    for p in sorted(glob.glob(os.path.expanduser("~/.fonts/**/*.[ot]tf"), recursive=True)):
        try:
            f = TTFont(p, lazy=True)
            n, os2 = f["name"], f["OS/2"]
            names.add(n.getDebugName(1))
            files.setdefault((n.getDebugName(16) or n.getDebugName(1), os2.usWeightClass, bool(os2.fsSelection & 1)), p)
        except Exception:
            pass
    return names, files


def effective_fonts(root):
    """(family, weight, italic) that each text and tspan is drawn in, following inheritance."""
    out = {}

    def walk(el, family, weight, style):
        family, weight, style = el.get("font-family", family), el.get("font-weight", weight), el.get("font-style", style)
        if el.tag in (T("text"), T("tspan")):
            w = {"normal": 400, "bold": 700}.get(weight) or (int(weight) if weight.isdigit() else 400)
            out[el] = (family.split(",")[0].strip(" '\""), w, style in ("italic", "oblique"))
        for c in el:
            walk(c, family, weight, style)

    walk(root, "sans-serif", "normal", "normal")
    return out


def face_name(family, w):
    return f"{family} {WEIGHT_STYLE.get(round(w / 100) * 100, '')}".strip()


def font_file(files, family, w, italic):
    return files.get((family, w, italic)) or files.get((face_name(family, w), w, italic))


def measuring_copy(base, eff, names):
    """The design ready for per-line renders: images removed, shapes hidden, and
    each weight other than 400/700 pointed at its own face.

    cairosvg draws <image> even with display="none", so images are removed. It
    also only asks cairo for normal or bold (600 renders Bold, 500 Regular), so a
    600 line is set as family "Mulish SemiBold", the static face setup.sh installs.
    Returns the tree and the weights that had no face of their own."""
    tree, missing = copy.deepcopy(base), set()
    for src, el in zip(base.getroot().iter(), tree.getroot().iter()):
        if el.tag in SHAPES:
            el.set("display", "none")
        elif src in eff:
            family, w, _ = eff[src]
            face = face_name(family, w)
            # set both on every element, so a tspan doesn't inherit its parent's rewrite
            if w in (400, 700) or face not in names:
                if w not in (400, 700):
                    missing.add(f"{family} {w}: no '{face}' face in ~/.fonts, rendered as {'Bold' if w >= 550 else 'Regular'}")
                el.set("font-family", family)
                el.set("font-weight", "bold" if w >= 550 else "normal")
            else:
                el.set("font-family", face)
                el.set("font-weight", "normal")
    for p in list(tree.getroot().iter()):
        for el in list(p):
            if el.tag == T("image"):
                p.remove(el)
    return tree, sorted(missing)


_fonts = {}


def advance_width(path, text, size, ls):
    """Unhinted width of text's ink in one font, in SVG units: the advance widths
    up to the last glyph plus letter-spacing, from the first glyph's left ink edge
    to the last's right. None if the font lacks a character."""
    if path not in _fonts:
        f = TTFont(path)
        _fonts[path] = (f.getBestCmap(), f.getGlyphSet(), f["hmtx"], f["head"].unitsPerEm)
    cmap, glyphs, hmtx, upm = _fonts[path]
    k, x, left, right = size / upm, 0.0, None, None
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            return None
        pen = BoundsPen(glyphs)
        glyphs[g].draw(pen)
        if pen.bounds:
            l, r = x + pen.bounds[0] * k, x + pen.bounds[2] * k
            left, right = (l, r) if left is None else (min(left, l), max(right, r))
        x += hmtx[g][0] * k + ls
    return None if left is None else right - left


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg"); ap.add_argument("screenshot")
    ap.add_argument("--scale", type=float, default=1.0, help="screenshot px per SVG unit (2 for retina)")
    ap.add_argument("--hinted", action="store_true", help="compare with the render's hinted width, as before (skews by a few %%)")
    a = ap.parse_args()

    base = ET.parse(a.svg)
    root = base.getroot()
    W, H = int(float(root.get("width"))), int(float(root.get("height")))
    shot = np.asarray(Image.open(a.screenshot).convert("RGB"))
    sw, sh = int(W * a.scale), int(H * a.scale)

    # Build list of line units: (text index, tspan index or None)
    texts = list(root.iter(T("text")))
    units = []
    for i, t in enumerate(texts):
        spans = [s for s in t.findall(T("tspan")) if s.get("y") is not None]
        if spans:
            units += [(i, j) for j in range(len(spans))]
        else:
            units.append((i, None))

    names, files = installed_fonts()
    eff = effective_fonts(root)
    meas, missing = measuring_copy(base, eff, names)
    for m in missing:
        print("note:", m)
    print(f"{'layer':34} {'text':28} {'dx':>5} {'ratio':>6}  suggestion")
    for i, j in units:
        # hide everything except this line; paint it black on white
        tree = copy.deepcopy(meas)
        r = tree.getroot()
        ts = list(r.iter(T("text")))
        for k, t in enumerate(ts):
            if k != i:
                t.set("display", "none")
            else:
                t.set("fill", "#000000")
                spans = [s for s in t.findall(T("tspan")) if s.get("y") is not None]
                for m, s in enumerate(spans):
                    if j is not None and m != j:
                        s.set("fill", "none")
        img = render(tree, sw, sh)
        rb = ink_box(img, (255, 255, 255), 120)
        t0 = texts[i]
        line_el = t0 if j is None else [s for s in t0.findall(T("tspan")) if s.get("y") is not None][j]
        content = "".join(line_el.itertext()).strip()
        layer = t0.get("id", "?")
        if rb is None:
            print(f"{layer[:34]:34} {content[:28]:28}  (nothing rendered — font missing?)")
            continue
        x0, y0, x1, y1, _ = rb
        size = float(attr(line_el, "font-size", t0, "16"))
        ls = float(attr(line_el, "letter-spacing", t0, "0"))
        pad = int(size * a.scale * 0.6)
        # screenshot band: same rows, wider columns; background = most common colour
        bx0, bx1 = max(0, x0 - pad), min(shot.shape[1], x1 + int((x1 - x0) * 0.25) + pad)
        band = shot[y0:y1 + 1, bx0:bx1]
        cols_, n_ = np.unique(band.reshape(-1, 3), axis=0, return_counts=True)
        bg = cols_[n_.argmax()]  # most common colour in the band
        sb = ink_box(band, bg, 90)
        if sb is None:
            print(f"{layer[:34]:34} {content[:28]:28}  (no ink in screenshot band)")
            continue
        # walk ink columns from the render start, stop at a gap > 0.5em
        cols = sb[4].any(0)
        gap_max = int(size * a.scale * 0.5)
        start = None
        for c in range(len(cols)):
            if cols[c] and bx0 + c >= x0 - pad:
                start = c; break
        if start is None:
            continue
        end, gap = start, 0
        for c in range(start, len(cols)):
            if cols[c]:
                end, gap = c, 0
            else:
                gap += 1
                if gap > gap_max:
                    break
        s0, s1 = bx0 + start, bx0 + end
        rw, swid, how = x1 - x0 + 1, s1 - s0 + 1, ""
        if not a.hinted:
            # expected width from the font file, when the whole line is in one font
            els = [e for e in line_el.iter() if e in eff]
            path = font_file(files, *eff[line_el])
            aw = None
            if path and len({eff[e] for e in els}) == 1 and not any(e.get("font-size") or e.get("letter-spacing") for e in els[1:]):
                aw = advance_width(path, content, size, ls)
            if aw:
                rw = aw * a.scale + 1  # +1: pixel extents count both end pixels
            else:
                how = " (render)"
        ratio = swid / rw
        dx = (s0 - x0) / a.scale
        n = max(len(content) - 1, 1)
        if len(content) < 3:
            sug = "short text: check visually (zoom crop)"
        elif abs(ratio - 1) <= 0.02 and abs(dx) <= 2:
            sug = "OK"
        elif ls or (content.isupper() and len(content) > 3):
            sug = f"letter-spacing {ls + (swid - rw) / a.scale / n:.2f}"
        else:
            sug = f"font-size {round(size * ratio * 2) / 2:g}"
        if abs(dx) > 2:
            sug += f"; shift x by {dx:+.0f}"
        print(f"{layer[:34]:34} {content[:28]:28} {dx:5.0f} {ratio:6.3f}  {sug}{how}")


if __name__ == "__main__":
    main()

"""Image comparison shared by screenshot-to-figma and html-to-figma.

  diff_png(render, reference, path)      red = only in render, cyan = only in
                                          reference, grey = matches
  zoom_png(render, reference, box, path) the box at 4x, reference on top, render below
  mismatch(render, reference)            share of differing pixels and the regions
                                          where they cluster

Both images are PIL images at the same scale; they are cropped to the overlap.
"""
import numpy as np
from PIL import Image


def _pair(render, reference):
    w, h = min(render.width, reference.width), min(render.height, reference.height)
    return render.convert("RGB").crop((0, 0, w, h)), reference.convert("RGB").crop((0, 0, w, h))


def diff_png(render, reference, path):
    r, s = _pair(render, reference)
    A, B = np.asarray(r.convert("L")), np.asarray(s.convert("L"))
    Image.fromarray(np.stack([B, A, A], -1)).save(path)
    return path


def zoom_png(render, reference, box, path):
    r, s = _pair(render, reference)
    zw, zh = (box[2] - box[0]) * 4, (box[3] - box[1]) * 4
    out = Image.new("RGB", (zw, zh * 2 + 4), "white")
    out.paste(s.crop(box).resize((zw, zh)), (0, 0))
    out.paste(r.crop(box).resize((zw, zh)), (0, zh + 4))
    out.save(path)
    return path


def mismatch(render, reference, thr=48, cell=16, min_share=0.08):
    """Return (share of pixels differing by more than thr in grey, regions).

    Regions are boxes (x0, y0, x1, y1, share) in image pixels, built by merging
    cell x cell tiles in which more than min_share of pixels differ.
    """
    r, s = _pair(render, reference)
    A = np.asarray(r.convert("L")).astype(int)
    B = np.asarray(s.convert("L")).astype(int)
    bad = np.abs(A - B) > thr
    h, w = bad.shape
    gh, gw = -(-h // cell), -(-w // cell)
    pad = np.zeros((gh * cell, gw * cell), bool)
    pad[:h, :w] = bad
    tiles = pad.reshape(gh, cell, gw, cell).mean((1, 3)) > min_share
    seen = np.zeros_like(tiles)
    regions = []
    for ty, tx in zip(*np.nonzero(tiles)):
        if seen[ty, tx]:
            continue
        stack, cells = [(ty, tx)], []
        seen[ty, tx] = True
        while stack:
            y, x = stack.pop()
            cells.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < gh and 0 <= nx < gw and tiles[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys, xs = [c[0] for c in cells], [c[1] for c in cells]
        x0, y0 = min(xs) * cell, min(ys) * cell
        x1, y1 = min(w, (max(xs) + 1) * cell), min(h, (max(ys) + 1) * cell)
        regions.append((x0, y0, x1, y1, float(bad[y0:y1, x0:x1].mean())))
    regions.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]) * b[4])
    return float(bad.mean()), regions

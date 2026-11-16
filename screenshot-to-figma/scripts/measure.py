#!/usr/bin/env python3
"""Pixel measurement helpers for rebuilding a screenshot as SVG.

  measure.py palette IMG [--top 12]          dominant colours (hex, share)
  measure.py sample IMG X,Y [X,Y ...]        exact colour at points
  measure.py darkest IMG X0,Y0,X1,Y1         darkest colour in a box (text colour)
  measure.py rows IMG X0 X1 [Y0 Y1]          ink bands in a column strip: top, bottom,
                                             baseline estimate, x extents
  measure.py edges IMG --row Y [--range A B] colour transitions along a row
  measure.py edges IMG --col X [--range A B] colour transitions along a column

Coordinates are screenshot pixels. Divide by the device scale (2 for retina)
to get SVG/CSS units.
"""
import sys, argparse
import numpy as np
from PIL import Image

hexc = lambda c: "#%02x%02x%02x" % tuple(int(v) for v in c[:3])


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(int)


def palette(a, top):
    flat = a.reshape(-1, 3)
    cols, counts = np.unique(flat, axis=0, return_counts=True)
    order = np.argsort(-counts)[:top]
    for i in order:
        print(f"{hexc(cols[i])}  {counts[i] / len(flat):6.2%}")


def rows(a, x0, x1, y0, y1, thr=60):
    strip = a[y0:y1, x0:x1]
    def mode(row):
        cols, n = np.unique(row, axis=0, return_counts=True)
        return cols[n.argmax()]
    bg = np.array([mode(r) for r in strip])[:, None, :]   # per-row background = most common colour
    ink = np.abs(strip - bg).sum(-1) > thr
    counts = ink.sum(1)
    y = 0
    while y < len(counts):
        if counts[y] == 0:
            y += 1; continue
        s = y
        while y < len(counts) and counts[y] > 0:
            y += 1
        band = counts[s:y]
        # baseline: last row still carrying >=35% of the band's peak ink
        base = s + max(i for i, c in enumerate(band) if c >= 0.35 * band.max()) + 1
        xs = np.nonzero(ink[s:y].any(0))[0]
        print(f"y {y0+s:5}-{y0+y-1:<5} h {y-s:3}  baseline~{y0+base:5}  x {x0+xs.min()}-{x0+xs.max()}")


def edges(a, row=None, col=None, rng=None):
    line = a[row, :] if row is not None else a[:, col]
    lo, hi = rng if rng else (0, len(line))
    prev = None
    for i in range(lo, hi):
        c = tuple(line[i])
        if c != prev:
            print(f"{i:5} {hexc(c)}")
            prev = c


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("palette"); p.add_argument("img"); p.add_argument("--top", type=int, default=12)
    p = sub.add_parser("sample"); p.add_argument("img"); p.add_argument("pts", nargs="+")
    p = sub.add_parser("darkest"); p.add_argument("img"); p.add_argument("box")
    p = sub.add_parser("rows"); p.add_argument("img"); p.add_argument("nums", nargs="+", type=int)
    p = sub.add_parser("edges"); p.add_argument("img"); p.add_argument("--row", type=int); p.add_argument("--col", type=int)
    p.add_argument("--range", type=int, nargs=2)
    a = ap.parse_args()
    img = load(a.img)
    if a.cmd == "palette":
        palette(img, a.top)
    elif a.cmd == "sample":
        for pt in a.pts:
            x, y = map(int, pt.split(",")); print(pt, hexc(img[y, x]))
    elif a.cmd == "darkest":
        x0, y0, x1, y1 = map(int, a.box.split(","))
        box = img[y0:y1, x0:x1].reshape(-1, 3); print(hexc(box[box.sum(1).argmin()]))
    elif a.cmd == "rows":
        n = a.nums; y0, y1 = (n[2], n[3]) if len(n) == 4 else (0, img.shape[0])
        rows(img, n[0], n[1], y0, y1)
    else:
        edges(img, a.row, a.col, a.range)


if __name__ == "__main__":
    main()

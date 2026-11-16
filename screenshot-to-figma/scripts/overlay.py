#!/usr/bin/env python3
"""Render an SVG and compare it with the screenshot.

  overlay.py design.svg screenshot.png [--scale 1] [--zoom X0,Y0,X1,Y1] [--out DIR]

Writes DIR/diff.png: red = only in the render, cyan = only in the screenshot,
grey = matches. With --zoom, also DIR/zoom.png: the box at 4x, screenshot on
top, render below (use for single glyphs, badges and icons). The comparison
itself lives in ../figma-svg/diff.py, shared with html-to-figma.
"""
import argparse, io, os, sys
import cairosvg
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "figma-svg"))
from diff import diff_png, zoom_png

ap = argparse.ArgumentParser()
ap.add_argument("svg"); ap.add_argument("shot")
ap.add_argument("--scale", type=float, default=1.0)
ap.add_argument("--zoom"); ap.add_argument("--out", default=".")
a = ap.parse_args()
shot = Image.open(a.shot)
r = Image.open(io.BytesIO(cairosvg.svg2png(url=a.svg, scale=a.scale, background_color="white")))
print("wrote", diff_png(r, shot, os.path.join(a.out, "diff.png")))
if a.zoom:
    box = tuple(int(v) for v in a.zoom.split(","))
    print("wrote", zoom_png(r, shot, box, os.path.join(a.out, "zoom.png")))

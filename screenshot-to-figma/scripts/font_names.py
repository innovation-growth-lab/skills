#!/usr/bin/env python3
"""Report the family/style names Figma will match for fonts.

  font_names.py FONT_FILE...                  .ttf/.otf/.woff/.woff2
  font_names.py fonts.json [--grep REGEX]     macOS: system_profiler SPFontsDataType -json

Use the "family" column as the SVG font-family and the weight class as
font-weight. Prefers the typographic family (name ID 16) over the legacy one
(ID 1): a file can say "Muli SemiBold" in ID 1 but "Muli" in ID 16.
"""
import sys, json, re, argparse


def from_files(paths):
    from fontTools.ttLib import TTFont
    for p in paths:
        t = TTFont(p, fontNumber=0)
        n = t["name"]
        g = lambda i: n.getDebugName(i)
        fam, sty = g(16) or g(1), g(17) or g(2)
        axes = ""
        if "fvar" in t:
            axes = " variable: " + ", ".join(f"{ax.axisTag} {ax.minValue:g}-{ax.maxValue:g}" for ax in t["fvar"].axes)
        print(f"{fam!r:24} {sty!r:14} weight {t['OS/2'].usWeightClass}{axes}   ({p.split('/')[-1]})")


def from_json(path, pattern):
    rx = re.compile(pattern, re.I) if pattern else None
    fams = {}
    for f in json.load(open(path))["SPFontsDataType"]:
        for tf in f.get("typefaces", []):
            fam = tf.get("family", "")
            if rx and not rx.search(fam):
                continue
            fams.setdefault(fam, set()).add(tf.get("style", ""))
    for fam in sorted(fams):
        print(f"{fam!r:28} {', '.join(sorted(fams[fam]))}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+"); ap.add_argument("--grep")
    a = ap.parse_args()
    if a.paths[0].endswith(".json"):
        from_json(a.paths[0], a.grep)
    else:
        from_files(a.paths)

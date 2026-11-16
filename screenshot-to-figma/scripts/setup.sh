#!/usr/bin/env bash
# Prepare the sandbox: renderer, font tools, and real fonts for the checks.
# Usage: setup.sh [FONT_FILE_OR_DIR ...]   (pass any font files the user uploaded)
set -u
pip install cairosvg fonttools numpy pillow --break-system-packages -q 2>&1 | tail -1
mkdir -p ~/.fonts
for src in "$@"; do
  if [ -d "$src" ]; then find "$src" -iname '*.[ot]tf' -exec cp {} ~/.fonts/ \; ; else cp "$src" ~/.fonts/ 2>/dev/null; fi
done
# Free families in the IGL stack, from the Google Fonts repo (OFL).
base=https://raw.githubusercontent.com/google/fonts/main/ofl
# cairosvg can only ask for "normal" or "bold", and cairo passes "normal" to
# fontconfig as weight 500, so it renders Regular text with whatever Medium face
# shares the family name: a variable font's named instance, or a static Medium.
# So install static Regular/Medium/SemiBold/Bold files only, and give Medium and
# SemiBold a family of their own ("Mulish SemiBold"), which check_text_fit.py
# asks for by name. IBM Plex Mono is published as static files; Mulish,
# Newsreader and IBM Plex Sans only as variable fonts, so instances are cut here.
rm -f ~/.fonts/*%5B*.ttf   # variable files left by older versions of this script
dl=$(mktemp -d)
for f in "Mulish mulish/Mulish%5Bwght%5D.ttf" "Newsreader newsreader/Newsreader%5Bopsz,wght%5D.ttf" \
         "IBMPlexSans ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf" \
         "IBMPlexMono-Regular ibmplexmono/IBMPlexMono-Regular.ttf" "IBMPlexMono-Medium ibmplexmono/IBMPlexMono-Medium.ttf" \
         "IBMPlexMono-SemiBold ibmplexmono/IBMPlexMono-SemiBold.ttf" "IBMPlexMono-Bold ibmplexmono/IBMPlexMono-Bold.ttf"; do
  name=${f%% *}; path=${f#* }
  curl -sfL "$base/$path" -o "$dl/$name.ttf" || echo "could not fetch $path"
done
python3 - "$dl" ~/.fonts <<'EOF'
import glob, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
src, dst = sys.argv[1:]


def install(font, name):
    if not name.endswith(("-Regular", "-Bold")):
        # drop the shared typographic family, leaving e.g. "Mulish SemiBold" / Regular
        font["name"].removeNames(nameID=16)
        font["name"].removeNames(nameID=17)
    font.save(os.path.join(dst, name + ".ttf"))


for path in sorted(glob.glob(os.path.join(src, "*.ttf"))):
    name = os.path.basename(path)[:-4]
    if "-" in name:  # already static
        install(TTFont(path), name)
        continue
    for wght, style in [(400, "Regular"), (500, "Medium"), (600, "SemiBold"), (700, "Bold")]:
        font = TTFont(path)
        # Pin the other axes (Newsreader's optical size, Plex Sans's width) at their
        # defaults, preferring the STAT's elidable value so the instance can be named
        # (Newsreader's fvar default is opsz 18, but its STAT only names 16pt).
        loc = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
        stat = font["STAT"].table
        tags = [a.AxisTag for a in stat.DesignAxisRecord.Axis]
        for v in stat.AxisValueArray.AxisValue:
            if v.Flags & 2 and v.Format in (1, 2, 3) and tags[v.AxisIndex] in loc:
                loc[tags[v.AxisIndex]] = v.NominalValue if v.Format == 2 else v.Value
        loc["wght"] = wght
        instantiateVariableFont(font, loc, inplace=True, updateFontNames=True)
        install(font, f"{name}-{style}")
    print(f"made static {name} Regular, Medium, SemiBold, Bold")
EOF
rm -rf "$dl"
fc-cache -f >/dev/null
echo "Fonts available to the renderer:"
fc-list : family style | grep -iE 'brown|mulish|muli|newsreader|plex' | sort -u

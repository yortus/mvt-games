# Spike: the sans test font with its outlines removed. Every glyph keeps its advance, kerning
# and weight axis, so text lays out as it would in the real font, and draws nothing.
#   python build-blank-real.py <in.otf> <out.otf> <family>
import sys
from fontTools.ttLib import TTFont

src, dst, family = sys.argv[1:4]
font = TTFont(src)
cff = font['CFF2'].cff
top = cff.topDictIndex[0]
for name in top.CharStrings.keys():
    cs = top.CharStrings[name]
    cs.decompile()
    cs.program = []
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = family if record.nameID != 6 else family.replace(' ', '')
font.save(dst)
print(dst)

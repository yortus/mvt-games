# Spike, rung 2: the test fonts as COLRv1 colour fonts. Every glyph with an outline gets a
# colour glyph of one layer, its own outline, painted in the current text colour (palette
# index 0xFFFF). Chrome draws colour glyphs as filled paths through Skia, not as glyph masks,
# so no platform text gamma applies. The outlines stay CFF2 and variable.
#   python build-colr.py <in.otf> <out.otf>
import sys
from fontTools.ttLib import TTFont
from fontTools.colorLib.builder import buildCOLR, buildCPAL

src, dst = sys.argv[1], sys.argv[2]
font = TTFont(src)
glyph_set = font.getGlyphSet()
order = font.getGlyphOrder()

color_glyphs = {}
for name in order:
    if name == '.notdef':
        continue
    # Only glyphs with an outline
    from fontTools.pens.boundsPen import BoundsPen
    pen = BoundsPen(glyph_set)
    glyph_set[name].draw(pen)
    if pen.bounds is None:
        continue
    color_glyphs[name] = {
        'Format': 10,  # PaintGlyph
        'Glyph': name,
        'Paint': {'Format': 2, 'PaletteIndex': 0xFFFF, 'Alpha': 1.0},  # PaintSolid, foreground colour
    }

font['COLR'] = buildCOLR(color_glyphs, version=1, glyphMap=font.getReverseGlyphMap())
font['CPAL'] = buildCPAL([[(0.0, 0.0, 0.0, 1.0)]])
# A distinct family name, so it can sit beside the plain font
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16, 17, 25):
        record.string = str(record.toUnicode()).replace('SourceSans3', 'SourceSans3Colr').replace('Source Sans 3', 'Source Sans 3 Colr').replace('SourceCode', 'SourceCodeColr').replace('Source Code', 'Source Code Colr')
font.save(dst)
print(f'{dst}: {len(color_glyphs)} colour glyphs')

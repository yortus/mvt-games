# Spike: two test fonts that fix text's layout without drawing letters.
#   VT Blank: every code point is one empty glyph, 0.6 em wide. Text takes its space and draws nothing.
#   VT Block: every code point is one bar, 0.5 em wide from the baseline to 0.5 em up. Text shows where it is.
# Both CFF2 (drawn by Chrome's own font engine everywhere), cmap format 13 (every code point, so nothing
# falls back to a system font), and fixed vertical metrics.
#   python build-test-fonts.py <out-dir>
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.misc.psCharStrings import T2CharString
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4, cmap_format_13

UPEM = 1000
ADVANCE = 600
ASCENT = 800
DESCENT = 200


def build(name, bar, path):
    fb = FontBuilder(UPEM, isTTF=False)
    glyphs = ['.notdef', 'g']
    fb.setupGlyphOrder(glyphs)
    if bar:
        # A rectangle from (50, 0) to (550, 500)
        program = [50, 0, 'rmoveto', 500, 'hlineto', 500, 'vlineto', -500, 'hlineto']
    else:
        program = []
    charstrings = {'.notdef': T2CharString(program=[]), 'g': T2CharString(program=program)}
    fb.setupCFF2(charstrings)
    fb.setupHorizontalMetrics({'.notdef': (ADVANCE, 0), 'g': (ADVANCE, 50 if bar else 0)})
    fb.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    fb.setupNameTable({'familyName': name, 'styleName': 'Regular'})
    fb.setupPost()
    # cmap: format 4 up to U+2FFF (its offsets cannot reach further), format 13 for every code point
    bmp = {cp: 'g' for cp in range(0x20, 0x3000)}
    everything = {cp: 'g' for cp in range(0x20, 0x110000) if not 0xD800 <= cp <= 0xDFFF}
    t4 = cmap_format_4(4)
    t4.platformID, t4.platEncID, t4.language, t4.cmap = 3, 1, 0, bmp
    t13 = cmap_format_13(13)
    t13.platformID, t13.platEncID, t13.language, t13.cmap = 3, 10, 0, everything
    fb.setupCharacterMap({cp: 'g' for cp in range(0x20, 0x7F)})
    fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=-DESCENT, sTypoLineGap=0, usWinAscent=ASCENT,
                usWinDescent=DESCENT, version=4, fsSelection=0x40 | 0x80, sxHeight=500, sCapHeight=700)
    fb.font['cmap'].tables = [t4, t13]
    fb.save(path)
    print(path)


out = sys.argv[1]
build('VT Blank', False, f'{out}/VTBlank.otf')
build('VT Block', True, f'{out}/VTBlock.otf')

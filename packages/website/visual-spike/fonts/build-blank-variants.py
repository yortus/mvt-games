# Spike: fixed-width invisible fonts, built different ways, to find one whose advances every system
# lays out the same (Windows and Linux round an empty CFF2 glyph's advance; macOS does not).
#   python build-blank-variants.py <out-dir>
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.misc.psCharStrings import T2CharString
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4, cmap_format_13

UPEM, ADVANCE, ASCENT, DESCENT = 1000, 600, 800, 200


def build(family, path, outline, truetype):
    fb = FontBuilder(UPEM, isTTF=truetype)
    fb.setupGlyphOrder(['.notdef', 'g'])
    if truetype:
        def glyph(kind):
            pen = TTGlyphPen(None)
            if kind == 'degenerate':
                pen.moveTo((300, 0)); pen.lineTo((301, 0)); pen.lineTo((300, 0)); pen.closePath()
            elif kind == 'far':
                pen.moveTo((300, -5000)); pen.lineTo((301, -5000)); pen.lineTo((301, -4999)); pen.closePath()
            return pen.glyph()
        fb.setupGlyf({'.notdef': glyph('empty'), 'g': glyph(outline)})
    else:
        programs = {
            'empty': [],
            'degenerate': [300, 0, 'rmoveto', 1, 0, 'rlineto', -1, 0, 'rlineto'],
            'far': [300, -5000, 'rmoveto', 1, 0, 'rlineto', 0, 1, 'rlineto'],
        }
        fb.setupCFF2({'.notdef': T2CharString(program=[]), 'g': T2CharString(program=programs[outline])})
    fb.setupHorizontalMetrics({'.notdef': (ADVANCE, 0), 'g': (ADVANCE, 300 if outline != 'empty' else 0)})
    fb.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    fb.setupNameTable({'familyName': family, 'styleName': 'Regular'})
    fb.setupPost()
    fb.setupCharacterMap({cp: 'g' for cp in range(0x20, 0x7F)})
    fb.setupOS2(version=4, sTypoAscender=ASCENT, sTypoDescender=-DESCENT, sTypoLineGap=0, usWinAscent=ASCENT,
                usWinDescent=DESCENT, fsSelection=0x40 | 0x80, sxHeight=500, sCapHeight=700)
    if truetype:
        fb.setupDummyDSIG() if hasattr(fb, 'setupDummyDSIG') else None
    t4 = cmap_format_4(4)
    t4.platformID, t4.platEncID, t4.language, t4.cmap = 3, 1, 0, {cp: 'g' for cp in range(0x20, 0x3000)}
    t13 = cmap_format_13(13)
    t13.platformID, t13.platEncID, t13.language = 3, 10, 0
    t13.cmap = {cp: 'g' for cp in range(0x20, 0x110000) if not 0xD800 <= cp <= 0xDFFF}
    fb.font['cmap'].tables = [t4, t13]
    fb.save(path)
    print(path)


out = sys.argv[1]
build('VT Blank Degenerate', f'{out}/VTBlankDegenerate.otf', 'degenerate', False)
build('VT Blank Far', f'{out}/VTBlankFar.otf', 'far', False)
build('VT Blank TT', f'{out}/VTBlankTT.ttf', 'empty', True)
build('VT Blank TT Degenerate', f'{out}/VTBlankTTDegenerate.ttf', 'degenerate', True)

# Fixture Fonts

v-snap's own visual tests register these fonts with the `fonts` option, in
`vitest.config.ts`, to test canvas text in a project's own fonts. They are
fixtures, so the published package leaves them out.

| File | Family | What it is |
| --- | --- | --- |
| `fixture-mono-regular.otf` | Fixture Mono, 400 | Source Code Pro at weight 400, as a static OpenType face |
| `fixture-mono-bold.woff` | Fixture Mono, 700 | Source Code Pro at weight 700, as a static WOFF face |
| `fixture-sans-regular.otf` | Fixture Sans, 400 | Source Sans 3 at weight 400, as a static OpenType face |

Each face holds only the space, the capitals, the digits and `,.:!-`, so
the tests can show lower case and other characters falling back to
another font. Fixture Mono is monospaced, unlike the sans-serif test font,
and Fixture Sans is proportional, unlike the monospace one, so the images
show which font drew each letter.

## How They Were Made

They were cut from v-snap's own test fonts, in `src/browser/fonts/`, with
fontTools 4.60.1, a Python library for font files. For each face, the
variable font was set to the face's weight with
`fontTools.varLib.instancer.instantiateVariableFont(font, {"wght": weight}, static=True)`,
then cut down with `fontTools.subset`, keeping its `kern` feature and its
`.notdef` outline. The face's names were set to its new family, its
`OS/2` weight class to its weight, and its selection flags to Regular or
Bold. `fixture-mono-bold.woff` was saved with the `woff` flavor, so the
tests read a WOFF file as well as OpenType.

## Licence

Source Code Pro and Source Sans 3 are © 2023 Adobe, under the SIL Open
Font License 1.1, with the Reserved Font Name "Source". A modified font
can't use a reserved name, so these faces are renamed Fixture Mono and
Fixture Sans. The licence's text is in
[src/browser/fonts/](../../src/browser/fonts/), beside the fonts they were
cut from.

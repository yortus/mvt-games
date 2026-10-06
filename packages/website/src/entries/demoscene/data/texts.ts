// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

// Every text is in capitals and the font's punctuation, and every line fits
// the screen's 40 columns. A test holds them to it.

/** The boot screen, above the prompt. Our own words, in the familiar colours. */
export const BOOT_BANNER: readonly string[] = [
    '',
    '    **** MVT SHOW SYSTEM  V1.0 ****',
    '',
    ' 64K RAM SYSTEM  ALL OF IT FOR THE DEMO',
    '',
    'READY.',
];

/** What the boot screen types at the prompt. */
export const BOOT_COMMAND = 'LOAD"MEGADEMO",1';

export const BOOT_SEARCHING = 'SEARCHING FOR MEGADEMO';
export const BOOT_FOUND = 'FOUND MEGADEMO';
export const BOOT_LOADING = 'LOADING';

/** The keys, on the boot screen's bottom line. */
export const BOOT_KEYS = '< > CURSOR KEYS SKIP BETWEEN PARTS';

/** The intro's captions, one after another. */
export const INTRO_CAPTIONS: readonly string[] = ['MVT PRESENTS', 'A MEGADEMO'];

/** Under the logo, colour-washed. */
export const LOGO_SUBTITLE = 'MODEL - VIEW - TICKER';

/** The sine scroller in the lower border. */
export const BORDER_SCROLLER_TEXT =
    'HELLO AND WELCOME TO THE MVT MEGADEMO! '
    + 'EVERYTHING YOU SEE IS DRAWN THROUGH A VIRTUAL VIDEO CHIP WITH THE MEMORY OF AN '
    + 'EIGHTIES HOME COMPUTER: SIXTEEN COLOURS, ONE COLOUR PER CHARACTER CELL, EIGHT SPRITES '
    + 'TO A LINE. AND THIS SCROLLER? IT LIVES IN THE BORDER, WHERE NO SCROLLER BELONGS... '
    + 'THE MODEL IS A CLOCK AND A SCRIPT. THE VIEW HOLDS NO STATE. ON WITH THE SHOW!     ';

/** The DYCP scroller over the plasma. */
export const DYCP_TEXT =
    'EACH LETTER OF THIS SCROLLER SITS AT ITS OWN HEIGHT, REDRAWN INTO A STRIP OF CHARACTERS '
    + 'EVERY FRAME, AND TAKES ITS COLOUR FROM THE PLASMA FLOWING BEHIND IT. '
    + 'THE PLASMA ITSELF IS JUST COLOUR MEMORY: A THOUSAND BYTES A FRAME.     ';

/** The sprites part's captions, top and bottom. */
export const SPRITES_CAPTION_TOP = '48 SPRITES ON SCREEN';
export const SPRITES_CAPTION_BOTTOM = 'THE CHIP HAS EIGHT';

/** The vectors part's caption, at the bottom. */
export const VECTORS_CAPTION = 'FILLED VECTORS';

/** The credits, scrolled upwards. */
export const CREDITS: readonly string[] = [
    'THE MVT MEGADEMO',
    '',
    'A TRIBUTE TO THE DEMOSCENE OF THE 1980S',
    '',
    '----------------------------------------',
    '',
    'CODE ............................. MVT',
    'GRAPHICS ................... TEXT ART',
    'FONT ..................... HAND DRAWN',
    'MUSIC .................. COMING SOON!',
    'VIDEO CHIP .................. VIRTUAL',
    '',
    '----------------------------------------',
    '',
    'EFFECTS IN ORDER OF APPEARANCE',
    '',
    'LOADING STRIPES',
    'RASTER BARS',
    'FADE TABLES',
    'FLD BOUNCE',
    'TECH-TECH',
    'MULTICOLOUR BITMAP LOGO',
    'OPEN BORDER SINE SCROLLER',
    'COLOUR MEMORY PLASMA',
    'DYCP SCROLLER',
    'FILLED VECTORS',
    'PARALLAX STARFIELD',
    'SPRITE MULTIPLEXER',
    'COLOUR WASH UPSCROLLER',
    '',
    '----------------------------------------',
    '',
    'GREETINGS TO',
    '',
    'EVERYONE WHO EVER TIMED A RASTER IRQ',
    'EVERYONE WHO TYPED IN A LISTING',
    'EVERYONE WHO REWOUND A TAPE WITH A PEN',
    'AND EVERYONE READING THE SOURCE',
    '',
    '----------------------------------------',
    '',
    'THE MODEL IS A CLOCK AND A SCRIPT.',
    'THE VIEW HOLDS NO STATE.',
    'EVERY FRAME IS DRAWN FROM SCRATCH.',
    '',
    'SPACE PAUSES',
    '< > CURSOR KEYS SKIP PARTS',
    '',
    '',
    '',
    'SEE YOU IN THE NEXT LOOP!',
];

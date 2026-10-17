import { canvasTest } from 'v-snap';
import { INSTRUMENT_NAMES, TUNES } from '#tunes';
import { textures } from '../../data';
import { InstrumentsView } from '../instruments-view';
import { createPixelFont } from '../pixel-font';
import { INSTRUMENTS_WIDTH, PANELS_HEIGHT } from '../view-constants';

const SIZE = { width: INSTRUMENTS_WIDTH, height: PANELS_HEIGHT, pixelArt: true };

async function poseInstruments(tuneIndex: number): Promise<ReturnType<typeof InstrumentsView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    const song = TUNES[tuneIndex].song;
    return InstrumentsView({ font, width: INSTRUMENTS_WIDTH, height: PANELS_HEIGHT, song: () => song, nameOf: (instrument) => INSTRUMENT_NAMES.get(instrument) ?? '' });
}

canvasTest('the first tune\'s', SIZE, () => poseInstruments(0));
// A tune with a sampled break, cut into slices, and a sampled choir
canvasTest('a tune with samples', SIZE, () => poseInstruments(TUNES.findIndex((tune) => tune.song.instruments.some((instrument) => (instrument.sample?.slices ?? 1) > 1))));

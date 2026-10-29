import { Container, Sprite, Texture } from 'pixi.js';
import type { Audio90Sound, Scope } from 'audio90';
import type { Tune } from '#tunes';
import type { MusicChip } from '#shared';
import type { TrackerModel } from '../models';
import { ChannelMetersView } from './channel-meters-view';
import { InstrumentsView } from './instruments-view';
import { OrderListView } from './order-list-view';
import { createPatternSheet } from './pattern-sheet';
import { PatternView } from './pattern-view';
import type { PixelFont } from './pixel-font';
import { SongPanelView } from './song-panel-view';
import { TitleBarView } from './title-bar-view';
import { TrackerAudioView } from './tracker-audio-view';
import { TuneListView } from './tune-list-view';
import {
    INSTRUMENTS_WIDTH, INSTRUMENTS_X, METERS_HEIGHT, METERS_Y, ORDER_WIDTH, ORDER_X, PANELS_HEIGHT, PANELS_Y, PATTERN_HEIGHT, PATTERN_LINES,
    PATTERN_Y, SCREEN_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH, SONG_WIDTH, SONG_X, TITLE_HEIGHT, TUNES_WIDTH, TUNES_X,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TrackerViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio90'>;
    /** What each of the chip's voices is playing, for the channels' meters. The chip fills it, so the view reads it once. */
    readonly scope: Scope;
    readonly model: TrackerModel;
    /** The tunes, in the order the model numbers them. */
    readonly tunes: readonly Tune[];
    /** Each instrument's name, as the instruments panel lists it. */
    readonly instrumentNames: ReadonlyMap<Audio90Sound, string>;
    readonly font: PixelFont;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The Tune Tracker's screen: the title bar, the panels of tunes, the song,
 * its order and its instruments, a meter over each channel, and the pattern
 * playing. The audio view plays the tunes on the chip, and the views that
 * show where the song is read the row the chip says is heard now. Each
 * tune's patterns are laid out once, as the view is made.
 */
export function TrackerView(bindings: TrackerViewBindings): Container {
    const { model, music, scope, tunes, instrumentNames, font } = bindings;
    const sheets = tunes.map((tune) => createPatternSheet({ song: tune.song }));
    const tune = () => tunes[model.tuneIndex];
    const song = () => tunes[model.tuneIndex].song;
    const sheet = () => sheets[model.tuneIndex];
    // A place is shown only if it is the place of the tune shown, so the views never read one tune's place
    // against another's patterns
    const orderIndex = () => (music.song === song() ? music.orderIndex : 0);
    const row = () => (music.song === song() ? music.row : 0);

    const view = new Container();
    const screen = new Sprite(Texture.WHITE);
    screen.tint = SCREEN_COLOR;
    screen.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    view.addChild(screen);

    view.addChild(TrackerAudioView({
        music,
        songAt: (index) => tunes[index].song,
        tuneIndex: () => model.tuneIndex,
        isPlaying: () => model.isPlaying,
        starts: () => model.starts,
    }));

    view.addChild(TitleBarView({
        font,
        width: SCREEN_WIDTH,
        height: TITLE_HEIGHT,
        isPlaying: () => model.isPlaying,
        playedMs: () => model.playedMs,
        orderIndex,
        row,
        onPlayPressed: () => model.playOrStop(),
    }));

    const tuneList = TuneListView({
        font,
        width: TUNES_WIDTH,
        height: PANELS_HEIGHT,
        names: tunes.map((each) => each.name),
        tuneIndex: () => model.tuneIndex,
        isPlaying: () => model.isPlaying,
        onTuneChosen: (index) => model.playTune(index),
    });
    tuneList.position.set(TUNES_X, PANELS_Y);
    view.addChild(tuneList);

    const songPanel = SongPanelView({ font, width: SONG_WIDTH, height: PANELS_HEIGHT, tune });
    songPanel.position.set(SONG_X, PANELS_Y);
    view.addChild(songPanel);

    const orderList = OrderListView({ font, width: ORDER_WIDTH, height: PANELS_HEIGHT, song, orderIndex, isPlaying: () => model.isPlaying });
    orderList.position.set(ORDER_X, PANELS_Y);
    view.addChild(orderList);

    const instruments = InstrumentsView({
        font,
        width: INSTRUMENTS_WIDTH,
        height: PANELS_HEIGHT,
        song,
        nameOf: (instrument) => instrumentNames.get(instrument) ?? '',
    });
    instruments.position.set(INSTRUMENTS_X, PANELS_Y);
    view.addChild(instruments);

    const meters = ChannelMetersView({ font, height: METERS_HEIGHT, sheet, scope });
    meters.y = METERS_Y;
    view.addChild(meters);

    const pattern = PatternView({ font, lineCount: PATTERN_LINES, height: PATTERN_HEIGHT, sheet, orderIndex, row });
    pattern.y = PATTERN_Y;
    view.addChild(pattern);

    return view;
}

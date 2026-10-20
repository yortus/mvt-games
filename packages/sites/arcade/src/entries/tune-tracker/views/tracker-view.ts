import { Container, Sprite, Texture } from 'pixi.js';
import { type Audio90, type Audio90Instrument, createMusicPlayer } from '@mvtjs/chiptune';
import { setUpdate } from '@mvtjs/pixi';
import type { Tune } from '#tunes';
import type { TrackerModel } from '../models';
import { ChannelMetersView } from './channel-meters-view';
import { createHeardRow } from './heard-row';
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
    readonly model: TrackerModel;
    /** The chip the tunes play on, which the view plays through and whose scopes it shows. */
    readonly sound: Audio90;
    /** The tunes, in the order the model numbers them. */
    readonly tunes: readonly Tune[];
    /** Each instrument's name, as the instruments panel lists it. */
    readonly instrumentNames: ReadonlyMap<Audio90Instrument, string>;
    readonly font: PixelFont;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The Tune Tracker's screen: the title bar, the panels of tunes, the song,
 * its order and its instruments, a meter over each channel, and the pattern
 * playing. The view owns the music player, as its view model: the audio
 * view plays through it. The music player writes each row a little ahead of
 * the sound, so the views that show where the song is read the row heard
 * now, which the view also owns. Each tune's patterns are laid out once, as
 * the view is made.
 */
export function TrackerView(bindings: TrackerViewBindings): Container {
    const { model, sound, tunes, instrumentNames, font } = bindings;
    const music = createMusicPlayer({ audio90: sound });
    const sheets = tunes.map((tune) => createPatternSheet({ song: tune.song }));
    const tune = () => tunes[model.tuneIndex];
    const song = () => tunes[model.tuneIndex].song;
    const sheet = () => sheets[model.tuneIndex];
    const heard = createHeardRow({ music, chip: sound });
    const orderIndex = () => heard.orderIndex;
    const row = () => heard.row;

    const view = new Container();
    // The view updates before its children, so the heard row sees the music player as the last tick left it
    setUpdate(view, heard.update);
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

    const meters = ChannelMetersView({ font, height: METERS_HEIGHT, sheet, scope: sound.scope });
    meters.y = METERS_Y;
    view.addChild(meters);

    const pattern = PatternView({ font, lineCount: PATTERN_LINES, height: PATTERN_HEIGHT, sheet, orderIndex, row });
    pattern.y = PATTERN_Y;
    view.addChild(pattern);

    return view;
}

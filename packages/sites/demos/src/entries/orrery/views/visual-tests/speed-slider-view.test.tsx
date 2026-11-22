/** @jsxImportSource @mvtjs/pixi */

import { canvasTest } from 'v-snap';
import { MAX_TURNS_PER_SECOND } from '../../data';
import { SPEED_SLIDER_HEIGHT, SPEED_SLIDER_WIDTH, SpeedSliderView } from '../speed-slider-view';

const SIZE = { width: SPEED_SLIDER_WIDTH, height: SPEED_SLIDER_HEIGHT, pixelArt: false };

// The knob sits on the middle notch, and the fill is empty
canvasTest('stopped', SIZE, () => <SpeedSliderView speed={() => 0} maxSpeed={MAX_TURNS_PER_SECOND} label={() => 'Stopped'} />);

// A quarter of the top speed sits half way along, since the scale is squared
canvasTest('a quarter speed forward', SIZE, () => (
    <SpeedSliderView speed={() => MAX_TURNS_PER_SECOND / 4} maxSpeed={MAX_TURNS_PER_SECOND} label={() => '140 days a second'} />
));

// The fill runs left from the middle to the knob, at the track's end
canvasTest('flat out backwards', SIZE, () => (
    <SpeedSliderView speed={() => -MAX_TURNS_PER_SECOND} maxSpeed={MAX_TURNS_PER_SECOND} label={() => '-558 days a second'} />
));

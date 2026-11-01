import { canvasTest } from 'v-snap';
import { PanelRowView } from '../panel-row-view';
import { WARNING_COLOR } from '../view-constants';

const SIZE = { width: 182, height: 16, pixelArt: false };

canvasTest('a label and its value', SIZE, () => PanelRowView({
    label: 'Search moves',
    value: () => '1669',
    color: () => 0xffffff,
    width: SIZE.width,
}));

canvasTest('a value in colour', SIZE, () => PanelRowView({
    label: 'Came out',
    value: () => 'Easy',
    color: () => WARNING_COLOR,
    width: SIZE.width,
}));

import { definePixiProject } from 'playground';
import { type ChestPhase, createChestModel } from './models';
import { ButtonView, ChestView, PhaseReadoutView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

/** The chest's phases, for the readout, in the order they run from open() to closed again. */
const PHASES: readonly ChestPhase[] = ['opening', 'open', 'closing', 'closed'];

// A chest that opens and closes when you ask it to. The buttons call the
// model's actions, and the model decides whether each is allowed: open()
// does nothing unless the chest is closed. The readout shows the phase and
// the progress, which stays at 1 while the chest waits.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const chest = createChestModel();

        const chestView = ChestView({ phase: () => chest.phase, progress: () => chest.progress });
        chestView.position.set(WIDTH / 2, 112);

        const readout = PhaseReadoutView({ phases: PHASES, phase: () => chest.phase, progress: () => chest.progress, width: READOUT_WIDTH });
        readout.position.set((WIDTH - READOUT_WIDTH) / 2, 200);

        const openButton = ButtonView({ label: 'open()', width: BUTTON_WIDTH, onPressed: () => chest.open() });
        openButton.position.set(WIDTH / 2 - BUTTON_WIDTH - 10, 300);
        const closeButton = ButtonView({ label: 'close()', width: BUTTON_WIDTH, onPressed: () => chest.close() });
        closeButton.position.set(WIDTH / 2 + 10, 300);

        stage.addChild(chestView, readout, openButton, closeButton);
        chest.open();
        return chest;
    },
});

const READOUT_WIDTH = 520;
const BUTTON_WIDTH = 140;

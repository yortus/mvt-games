import { type Audio90PassedMessage, AUDIO90_PROCESSOR_NAME, type Audio90RunnerSettings, createAudio90Runner } from './audio90-runner';
import { registerChipProcessor } from './register-chip-processor';

// The Audio90's worklet module, which `createAudio90` loads on the audio
// thread. It bundles only the Audio90's synthesiser, so a page whose entries
// play only on the Audio80 never downloads it.

registerChipProcessor<Audio90RunnerSettings, Audio90PassedMessage>(AUDIO90_PROCESSOR_NAME, ({ settings, sampleRate, currentFrame, post }) =>
    createAudio90Runner({
        ...settings,
        sampleRate,
        currentFrame,
        // A buffer goes back to the page, moved rather than copied. A clock reply is only numbers
        sendBack: (reply) => post(reply, reply.kind === 'buffer' ? [reply.commands.buffer] : NOTHING_MOVED),
        sendScope: (reply) => post(reply, [reply.data.buffer]),
        sendPlace: (reply) => post(reply, NOTHING_MOVED),
    }));

/** What a song's place, or a clock reply, moves with it: nothing, since it is only numbers. */
const NOTHING_MOVED: Transferable[] = [];

import { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings, createAudio80Runner } from './audio80-runner';
import { registerChipProcessor } from './register-chip-processor';

// The Audio80's worklet module, which `createAudio80` loads on the audio
// thread. It bundles only the Audio80's synthesiser.

registerChipProcessor<Audio80RunnerSettings, Audio80PassedMessage>(AUDIO80_PROCESSOR_NAME, ({ settings, sampleRate, currentFrame, post }) =>
    createAudio80Runner({
        ...settings,
        sampleRate,
        currentFrame,
        // A buffer goes back to the page, moved rather than copied. A clock reply is only numbers
        sendBack: (reply) => post(reply, reply.kind === 'buffer' ? [reply.commands.buffer] : NOTHING_MOVED),
        sendPlace: (reply) => post(reply, NOTHING_MOVED),
    }));

/** What a song's place, or a clock reply, moves with it: nothing, since it is only numbers. */
const NOTHING_MOVED: Transferable[] = [];

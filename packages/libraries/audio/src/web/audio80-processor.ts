import { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings, createAudio80Runner } from './audio80-runner';
import { registerChipProcessor } from './register-chip-processor';

// The Audio80's worklet module, which `createWebAudio80` loads on the audio
// thread. It bundles only the Audio80's synthesiser.

registerChipProcessor<Audio80RunnerSettings, Audio80PassedMessage>(AUDIO80_PROCESSOR_NAME, ({ settings, sampleRate, post }) =>
    createAudio80Runner({ ...settings, sampleRate, sendBack: (reply) => post(reply, [reply.commands.buffer]) }));

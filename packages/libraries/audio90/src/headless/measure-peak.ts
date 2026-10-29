import { listChannels, type RenderedSamples } from './stereo-samples';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The peak level of rendered sound, from 0 to 1, or more if it clips. For stereo sound, it is the louder channel's. */
export function measurePeak(samples: RenderedSamples): number {
    let peak = 0;
    for (const channel of listChannels(samples)) {
        for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]));
    }
    return peak;
}

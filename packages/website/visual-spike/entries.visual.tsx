// Spike: every Pixi entry's whole screen.
import { describe } from 'vitest';
import { entryPose, entrySize, PIXI_ENTRIES } from './entry-poses';
import { visualTest } from './harness';

describe('entries', () => {
    for (const id of PIXI_ENTRIES) {
        visualTest(`${id} thumbnail`, entryPose(id, 'thumbnail'), entrySize(id));
        visualTest(`${id} 2s`, entryPose(id, 2000), entrySize(id));
    }
});

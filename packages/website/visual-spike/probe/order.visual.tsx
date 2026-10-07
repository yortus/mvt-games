// Spike probe: which part of a pixel-art picture (no MSAA, rounded positions) changes the reel windows after it?
import { describe } from 'vitest';
import { visualTest } from '../harness';
import { speedPose } from '../speed/poses';

const R = speedPose(39);
const S = speedPose(0);
const reel = (label: string) => { for (let i = 0; i < 3; i++) visualTest(`${label} ${i}`, R.pose); };

describe('repeat', () => {
    reel('A');
    visualTest('spin: no msaa, round', S.pose, { msaa: false, round: true });
    reel('B');
    visualTest('spin: msaa, no round', S.pose);
    reel('C');
    visualTest('spin: no msaa, no round', S.pose, { msaa: false, round: false });
    reel('D');
    visualTest('spin: msaa, round', S.pose, { msaa: true, round: true });
    reel('E');
    visualTest('reel: no msaa', R.pose, { msaa: false, round: false });
    reel('F');
});

import { describe, expect, it } from 'vitest';
import { splitTestOptions } from './test-options';

describe('splitTestOptions', () => {
    it("gives Vitest's options to the test, and the rest to the image", () => {
        const options = { kind: 'three', width: 200, camera: 'a camera', timeout: 5000, retry: 2, repeats: 1, fails: true };
        expect(splitTestOptions(options)).toEqual({
            test: { concurrent: false, timeout: 5000, retry: 2, repeats: 1, fails: true },
            image: { kind: 'three', width: 200, camera: 'a camera' },
        });
    });

    it('never lets a test run concurrently', () => {
        expect(splitTestOptions({ concurrent: true }).test.concurrent).toBe(false);
        expect(splitTestOptions({}).test).toEqual({ concurrent: false });
    });
});

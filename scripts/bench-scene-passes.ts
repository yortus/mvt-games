import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
// Imported past the plugin's barrel on purpose: the benchmark scenes are not
// part of its public API, which is four names and stays that way.
import {
    benchmarkArms,
    runBenchmarkArm,
    type BenchmarkResult,
} from '../src/pixi-mvt-plugin/scene-passes-benchmark';

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

// Runs the scene-pass benchmarks, one arm per child process:
//
//     npm run bench
//     npx tsx scripts/bench-scene-passes.ts sparse memo   # one arm, on its own
//
// The separate processes are the point. Two arms declared side by side in one
// process share their inline caches, and the first one declared wins by more
// than 2x whichever order they are written in. They also let the `patched` and
// `unpatched` arms differ by whether the plugin was ever imported.

await main();

async function main(): Promise<void> {
    const scenario = process.argv[2];
    const arm = process.argv[3];
    if (scenario === undefined || arm === undefined) {
        runEveryArm();
        return;
    }
    const result = await runBenchmarkArm(scenario, arm);
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

/** Parent process: one child per arm, then a table. */
function runEveryArm(): void {
    const self = fileURLToPath(import.meta.url);
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < benchmarkArms.length; i++) {
        const { scenario, arm } = benchmarkArms[i];
        process.stdout.write(`running ${scenario}:${arm} ...`);
        const child = spawnSync(
            process.execPath,
            [...process.execArgv, self, scenario, arm],
            { encoding: 'utf8' },
        );
        if (child.status !== 0) {
            process.stdout.write(` failed\n${child.stderr}\n`);
            process.exitCode = 1;
            continue;
        }
        const lines = child.stdout.trim().split('\n');
        const result = JSON.parse(lines[lines.length - 1]) as BenchmarkResult;
        results.push(result);
        process.stdout.write(` ${result.usPerFrame.toFixed(2)} us\n`);
    }

    process.stdout.write(`\n${formatTable(results)}\n`);
}

function formatTable(results: BenchmarkResult[]): string {
    const lines: string[] = [
        '| scenario | arm | us/frame | hook calls/frame |',
        '| --- | --- | --- | --- |',
    ];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        lines.push(
            `| ${result.scenario} | ${result.arm} `
            + `| ${result.usPerFrame.toFixed(2)} | ${result.callsPerFrame} |`,
        );
    }
    return lines.join('\n');
}

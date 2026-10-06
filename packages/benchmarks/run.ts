import process from 'node:process';
import { defaultJobs, reportSuite, runSuite } from './harness/driver';
import type { Suite } from './harness/suite';
import { suites } from './suites';

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

// Runs benchmark suites. See packages/benchmarks/README.md.
//
//     npm run bench                                   # list the suites
//     npm run bench -- reactivity                     # run one suite
//     npm run bench -- reactivity approach=solid      # only matching cases
//     npm run bench -- reactivity --runs=5            # processes per case, always (default: 2, or 3 if they disagree)
//     npm run bench -- memory --save                  # write packages/benchmarks/results/
//     npm run bench -- all --save                     # every suite whose inputs changed since its save
//     npm run bench -- all --save --force             # every suite, changed or not
//     npm run bench -- all --save --extended          # every suite, extended cases included
//     npm run bench -- memory --jobs=4                # counts-only processes at once (default: half the cores, at most 8)
//     npm run bench -- memory --report                # re-render results/ tables from the saved JSON

await main(process.argv.slice(2));

async function main(args: string[]): Promise<void> {
    const names: string[] = [];
    const filters: Record<string, string> = {};
    let runs: number | undefined;
    let save = false;
    let reportOnly = false;
    let extended = false;
    let force = false;
    let jobs = defaultJobs();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--save') save = true;
        else if (arg === '--report') reportOnly = true;
        else if (arg === '--extended') extended = true;
        else if (arg === '--force') force = true;
        else if (arg.startsWith('--runs=')) runs = Number(arg.slice('--runs='.length));
        else if (arg.startsWith('--jobs=')) jobs = Math.max(1, Number(arg.slice('--jobs='.length)));
        else if (arg.startsWith('--')) throw new Error(`unknown option '${arg}'`);
        else if (arg.includes('=')) {
            const at = arg.indexOf('=');
            filters[arg.slice(0, at)] = arg.slice(at + 1);
        }
        else names.push(arg);
    }

    if (names.length === 0) {
        process.stdout.write('Usage: npm run bench -- <suite ...|all> [param=value ...] [--runs=N] [--jobs=N] [--extended] [--save [--force] | --report]\n\nSuites:\n');
        for (let i = 0; i < suites.length; i++) {
            process.stdout.write(`  ${suites[i].name.padEnd(18)} ${suites[i].description}\n`);
        }
        return;
    }

    const selected = names.includes('all') ? suites : names.map(findSuite);
    for (let i = 0; i < selected.length; i++) {
        if (reportOnly) reportSuite(selected[i]);
        else await runSuite(selected[i], { filters, runs, save, extended, force, jobs });
    }
}

function findSuite(name: string): Suite {
    const suite = suites.find((s) => s.name === name);
    if (suite === undefined) throw new Error(`unknown suite '${name}'. Run \`npm run bench\` to list them.`);
    return suite;
}

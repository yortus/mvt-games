import process from 'node:process';
import { reportSuite, runSuite } from './harness/driver';
import type { Suite } from './harness/suite';
import { suites } from './suites';

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

// Runs benchmark suites. See benchmarks/README.md.
//
//     npm run bench                                   # list the suites
//     npm run bench -- reactivity                     # run one suite
//     npm run bench -- reactivity approach=solid      # only matching cases
//     npm run bench -- reactivity --runs=5            # processes per case
//     npm run bench -- memory --save                  # write benchmarks/results/
//     npm run bench -- all --save                     # every suite
//     npm run bench -- memory --report                # re-render results/ tables from the saved JSON

await main(process.argv.slice(2));

async function main(args: string[]): Promise<void> {
    const names: string[] = [];
    const filters: Record<string, string> = {};
    let runs: number | undefined;
    let save = false;
    let reportOnly = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--save') save = true;
        else if (arg === '--report') reportOnly = true;
        else if (arg.startsWith('--runs=')) runs = Number(arg.slice('--runs='.length));
        else if (arg.includes('=')) {
            const at = arg.indexOf('=');
            filters[arg.slice(0, at)] = arg.slice(at + 1);
        }
        else names.push(arg);
    }

    if (names.length === 0) {
        process.stdout.write('Usage: npm run bench -- <suite ...|all> [param=value ...] [--runs=N] [--save | --report]\n\nSuites:\n');
        for (let i = 0; i < suites.length; i++) {
            process.stdout.write(`  ${suites[i].name.padEnd(18)} ${suites[i].description}\n`);
        }
        return;
    }

    const selected = names.includes('all') ? suites : names.map(findSuite);
    for (let i = 0; i < selected.length; i++) {
        if (reportOnly) reportSuite(selected[i]);
        else await runSuite(selected[i], { filters, runs, save });
    }
}

function findSuite(name: string): Suite {
    const suite = suites.find((s) => s.name === name);
    if (suite === undefined) throw new Error(`unknown suite '${name}'. Run \`npm run bench\` to list them.`);
    return suite;
}

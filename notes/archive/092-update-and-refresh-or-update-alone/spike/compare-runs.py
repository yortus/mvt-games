"""Compares each mode's Vitest JSON report with the baseline. Usage: python compare-runs.py <runs dir> <mode>..."""
import json, sys, re, collections

runs = sys.argv[1]


def load(mode):
    data = json.load(open(f'{runs}/{mode}.json', encoding='utf-8'))
    out = {}
    suite_fail = []
    for f in data['testResults']:
        name = f['name'].replace('\\', '/')
        name = re.sub(r'^.*merge-spike/', '', name)
        if not f['assertionResults'] and f.get('status') == 'failed':
            suite_fail.append((name, (f.get('message') or '')[:200]))
        for a in f['assertionResults']:
            out[(name, a['fullName'])] = (a['status'], (a.get('failureMessages') or [''])[0][:240])
    return data, out, suite_fail


base_data, base, base_suite = load('off')
print('off: total', base_data['numTotalTests'], 'passed', base_data['numPassedTests'], 'failed', base_data['numFailedTests'],
      'files failed to run', len(base_suite))
for k, v in base.items():
    if v[0] == 'failed':
        print('  BASE FAIL', k[0], '::', k[1][:90], '::', v[1][:120].replace('\n', ' '))
for s in base_suite:
    print('  BASE SUITE', s)


def area(path):
    if path.startswith('packages/libraries/utils/src/view-tick-api') or '/conformance/' in path:
        return 'tick API itself'
    if path.startswith('packages/libraries'):
        return 'libraries'
    if 'visual-tests' in path:
        return 'visual'
    return 'unit (sites)'


for mode in sys.argv[2:]:
    data, cur, suite = load(mode)
    newly = [k for k, v in cur.items() if v[0] == 'failed' and base.get(k, ('',))[0] != 'failed']
    fixed = [k for k, v in base.items() if v[0] == 'failed' and cur.get(k, ('',))[0] == 'passed']
    print(f'\n=== {mode}: total {data["numTotalTests"]} passed {data["numPassedTests"]} failed {data["numFailedTests"]}'
          f' newly failing {len(newly)} fixed {len(fixed)} files failed to run {len(suite)}')
    by = collections.Counter(area(k[0]) for k in newly)
    print('  by area', dict(by))
    files = collections.Counter(k[0] for k in newly)
    for f, n in files.most_common(70):
        print(f'  {n:4d} {f}')
    for s in suite:
        print('  SUITE', s)

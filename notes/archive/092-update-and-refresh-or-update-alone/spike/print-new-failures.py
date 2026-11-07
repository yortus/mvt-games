"""Prints each newly failing test's message, skipping the tick API's own files. Usage: python print-new-failures.py <runs dir> <mode> [filter]"""
import json, sys, re
runs, mode = sys.argv[1], sys.argv[2]
flt = sys.argv[3] if len(sys.argv) > 3 else ''


def load(m):
    out = {}
    for f in json.load(open(f'{runs}/{m}.json', encoding='utf-8'))['testResults']:
        n = re.sub(r'^.*merge-spike/', '', f['name'].replace('\\', '/'))
        for a in f['assertionResults']:
            out[(n, a['fullName'])] = (a['status'], (a.get('failureMessages') or [''])[0])
    return out


base, cur = load('off'), load(mode)
for k, v in cur.items():
    if v[0] != 'failed' or base.get(k, ('',))[0] == 'failed':
        continue
    if flt and flt not in k[0]:
        continue
    if not flt and ('view-tick-api' in k[0] or 'conformance' in k[0]):
        continue
    msg = re.sub(r'\x1b\[[0-9;]*m', '', v[1])
    msg = re.sub(r'\s+at .*', '', msg, flags=re.S)
    print(f'- {k[0].replace("packages/", "")} :: {k[1][:110]}\n    {msg[:230]!r}')

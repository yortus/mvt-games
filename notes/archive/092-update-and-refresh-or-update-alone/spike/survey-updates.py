"""Extracts each view update step's body in product code, and flags what it does. Usage: python survey-updates.py <repo root> <output json>"""
import re, subprocess, sys, json

root = sys.argv[1]
files = subprocess.run(
    ['git', '-C', root, 'grep', '-lE', r'setUpdate\(|onUpdate=', '--', 'packages/sites'],
    capture_output=True, text=True, encoding='utf-8').stdout.split()
files = [f for f in files if not re.search(
    r'\.test\.|test-support|/docs/|cheat-sheets|/playground/(book|examples|starters)/', f)]


def body_of(src, start):
    """Text of the brace block opening at or after start."""
    i = src.index('{', start)
    depth, j = 0, i
    while j < len(src):
        c = src[j]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    return src[i:]


RELAY = re.compile(r'\b(bindings\.on[A-Z]\w*|on[A-Z]\w*\??\.?\()')
MODEL_CALL = re.compile(r'\bmodel\.(?!update\b)[a-zA-Z]+\(|\bmodel\.\w+(\.\w+)*\s*=[^=]')
OUTPUT = re.compile(r'\.(alpha|visible|x|y|rotation|text|tint|texture|scrollTop|textContent)\s*=[^=]|\.position\.set|\.scale\.set|addChild|removeChild|\.clear\(\)|\.classList\.|\.style\.')
SOUND = re.compile(r'\b(sfx|music|chip)\.\w+\(')
SKIP = re.compile(r'SKIP_DESCENDANTS')

rows = []
for f in files:
    src = open(f'{root}/{f}', encoding='utf-8').read()
    names = set(re.findall(r'setUpdate\(\s*\w+,\s*([A-Za-z_][\w.]*)\s*\)', src))
    names |= set(re.findall(r'onUpdate=\{\s*([A-Za-z_][\w.]*)\s*\}', src))
    bodies = []
    for n in names:
        simple = n.split('.')[-1]
        if '.' in n:
            bodies.append((n, f'<delegates to {n}>'))
            continue
        m = re.search(r'function\s+' + re.escape(simple) + r'\s*\(', src)
        if m:
            bodies.append((n, body_of(src, m.end())))
    for m in re.finditer(r'(setUpdate\(\s*\w+,\s*\(|onUpdate=\{\s*\()', src):
        tail = src[m.end():]
        arrow = re.match(r'[^)]*\)(?:\s*:\s*\w+)?\s*=>\s*', tail)
        if arrow is None:
            continue
        s = m.end() + arrow.end()
        if src[s] == '{':
            bodies.append(('(inline)', body_of(src, s)))
        else:
            bodies.append(('(inline)', src[s:src.index('\n', s)]))
    # helpers called from an update body, one level deep
    for name, b in bodies:
        expanded = b
        for call in set(re.findall(r'\b([a-z]\w+)\(', b)):
            m = re.search(r'function\s+' + re.escape(call) + r'\s*\(', src)
            if m:
                expanded += '\n' + body_of(src, m.end())
        rows.append({
            'file': f.replace('packages/sites/', ''), 'name': name, 'lines': b.count('\n') + 1,
            'relay': sorted({m.group(0) for m in RELAY.finditer(expanded)})[:4],
            'modelWrite': sorted({m.group(0).strip() for m in MODEL_CALL.finditer(expanded)})[:4],
            'output': sorted({m.group(0).strip() for m in OUTPUT.finditer(expanded)})[:4],
            'sound': sorted({m.group(0) for m in SOUND.finditer(expanded)})[:4],
            'skip': bool(SKIP.search(expanded)),
        })

print('files', len(files), 'update steps', len(rows))
for key in ('relay', 'modelWrite', 'output', 'sound', 'skip'):
    hits = [r for r in rows if r[key]]
    print(f'\n== {key}: {len(hits)}')
    for r in hits:
        print(' ', r['file'], r['name'], r[key])
print('\n== delegates', len([r for r in rows if r['lines'] == 1 and 'delegates' in str(r)]))
json.dump(rows, open(sys.argv[2], 'w'), indent=1)

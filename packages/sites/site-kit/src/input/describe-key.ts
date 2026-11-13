/**
 * Names a key in words, as a player reads it on the key cap. `' '` is
 * `'Space'`, and `'ArrowLeft'` is `'Left'`. A letter is in upper case. Any
 * other key keeps the name `KeyboardEvent.key` has for it, such as
 * `'Enter'`. The words are plain ASCII, so a pixel font can show them.
 */
export function describeKey(key: string): string {
    if (key === ' ') return 'Space';
    if (key.startsWith('Arrow')) return key.slice('Arrow'.length);
    return key.length === 1 ? key.toUpperCase() : key;
}

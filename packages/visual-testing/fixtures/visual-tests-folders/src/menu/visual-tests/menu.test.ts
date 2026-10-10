import { describe } from 'vitest';
import { htmlTest } from '@mvtjs/visual-testing';

describe('Menu', () => {
    htmlTest('two buttons', () => {
        const menu = document.createElement('div');
        menu.style.cssText = 'display:flex;gap:8px;padding:8px;';
        menu.innerHTML = '<button style="width:60px;height:24px">Play</button><button style="width:60px;height:24px">Quit</button>';
        return menu;
    });
});

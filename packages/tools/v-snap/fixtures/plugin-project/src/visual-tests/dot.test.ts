import { canvasTest } from 'v-snap';

canvasTest('a dot', { kind: 'canvas' }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D context.');
    ctx.fillStyle = '#5bd1ff';
    ctx.beginPath();
    ctx.arc(20, 20, 12, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
});

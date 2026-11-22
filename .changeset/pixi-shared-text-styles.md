---
'@mvtjs/pixi': minor
---

In JSX, texts passed the same `style` object now share one Pixi `TextStyle`. So texts with the same string and style share one texture, drawn and kept on the GPU once. Before, every text made a style of its own, and so a texture of its own. `style` now replaces a text's style rather than merging into it. That differs only when a `style` getter switches between objects. Because the style is shared, changing it in code (`text.style.fill = ...`) changes every text passed the same object. For a style of its own, pass a text an inline object or a `TextStyle` of its own.

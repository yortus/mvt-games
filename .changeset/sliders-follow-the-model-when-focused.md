---
'@mvtjs/html': patch
---

`value` and `valueAsNumber` are now skipped while focused only for text-like fields (text, number, date, `<textarea>`), so a refresh never overwrites what the user is typing. Sliders, colour pickers and `<select>` are now written even while focused, so a change the model makes elsewhere (such as a mute button setting a volume slider to 0) shows at once, not when the field loses focus.

Such fields should report the user's changes through `onInput`. `onChange` fires only when a slider is let go or a colour picker closes, and until then each refresh puts the model's value back.

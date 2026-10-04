---
'@mvtjs/utils': patch
---

`<List>`: an empty slot now skips its item view's update steps in `updateView`, as it already skipped its refresh in `refreshView`, so no update step sees an absent item. An update step sees the item its slot showed at its last refresh. Only a slot whose item view has an update step is gated, so a list without any costs no more than before.

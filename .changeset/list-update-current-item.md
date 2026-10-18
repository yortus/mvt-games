---
'@mvtjs/utils': patch
---

A `<List>` item view's update step now sees its slot's item as it is now. Before, it saw the item its slot showed at the last refresh, so in the frame after the model removed or replaced an item, the update step still got the old one. A slot emptied since the last refresh now skips its update steps at once.

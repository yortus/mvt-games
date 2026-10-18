---
'@mvtjs/html': patch
---

A `<select>` given a fixed `value`, such as `<select value="b">`, now shows that option. Before, it showed its first option, since the value was written before the options were added.

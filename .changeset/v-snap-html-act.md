---
'v-snap': minor
---

HTML tests can act on their view once it is in the page, with `act`, such as to hover over it, focus it or open a menu with Vitest's `userEvent`; the pointer leaves the page afterwards. A test's `viewport` and `colorScheme` set what its media queries see, and `vsnap()`'s `viewport` and `colorScheme` options set the page's own. The calibration set checks dark form controls too.

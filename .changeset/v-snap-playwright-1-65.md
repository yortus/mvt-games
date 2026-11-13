---
'v-snap': minor
---

v-snap supports Playwright 1.65, whose headless shell is Chrome 158. Install `playwright@~1.65.0` with it. No image changed between the two builds, so your references stay as they are.

Fixes. A Pixi test's `BitmapText` draws the same whatever ran before it. Pixi makes a bitmap font for each family that `BitmapText` asks for, and keeps it for the page's life. It packs the glyphs into one texture in the order that they're first asked for, and draws small text from a mipmap, where each glyph blends with its neighbours. So in the shared page, a test's digits could come out a little differently, depending on which test file ran first. v-snap now destroys those fonts before each Pixi test. A font that you install with `BitmapFont.install` is left alone. And text in a closed shadow root is drawn blank, with its font sizes rounded and its animations brought to rest, as in an open one. v-snap keeps each root that `attachShadow` makes, so it can reach a root that its host keeps closed. A reference image of a view with a closed shadow root changes once, so update it with `-u`.

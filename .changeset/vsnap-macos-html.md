---
'v-snap': patch
---

HTML images match on macOS and other arm64 machines in two more cases. v-snap now waits for two frames before it takes an HTML view's image, so a view that lays itself out in a frame, such as a CodeMirror editor measuring its lines, has settled even on a slow machine. And it draws each scroll container with rounded corners as part of the page, by setting its `overflow` to `hidden` while it takes the image. Browsers draw a scrollable container as a layer of its own, and arm64 processors round the edges of that layer's rounded corners differently. The container keeps its layout and its scroll position. A reference image of such a container that was written on an x64 machine changes slightly at the corners, so update it once with `-u`.

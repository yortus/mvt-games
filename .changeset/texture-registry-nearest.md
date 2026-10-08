---
'@mvtjs/pixi': patch
---

`createTextureRegistry` samples its spritesheet nearest-neighbour as intended: Pixi 8 ignored the option it passed, so a sheet took whatever `TextureSource.defaultOptions.scaleMode` was when it loaded.

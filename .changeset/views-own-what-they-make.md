---
'@mvtjs/utils': minor
'@mvtjs/pixi': minor
'@mvtjs/three': minor
'@mvtjs/html': minor
---

Every JSX element now accepts an `owns` attribute. It lists the resources that your view made for the element, such as textures, geometries and materials. Each one is freed when the element is destroyed, so you don't need an `onDestroyed` to free them. Each renderer frees a resource its own way. `@mvtjs/pixi` destroys it, and destroys a texture's source with the texture. `@mvtjs/three` disposes it. `@mvtjs/html` aborts anything with an `abort()` method, such as an `AbortController`. It closes anything with a `close()` method, and destroys anything with a `destroy()` method. Each package exports the type that its `owns` attribute accepts as `OwnedResource`.

An element table can now define creation attributes, with `creation()`, or with `creation({ required: true })` for one that the element can't be made without. They're for options that a renderer reads only in its constructor, such as the size of a batch. The runtime passes their values to the element's `create`.

Breaking: `JsxTarget` has a new `release` function, which frees a resource that an `owns` attribute lists. A JSX target of your own needs to add it.

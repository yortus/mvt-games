# Building a Showcase

A site browses its entries in one of two ways, on the card wall or in its
showcase. A showcase is a 3D scene that holds the site's entries, for the
visitor to walk round and play. The arcade's is the Arcade Hall, a room of
cabinets. The demos' is the Gallery, with a painting for each demo. The
puzzles' is a newspaper, The Daily Fold, with a puzzle on each spread. Look
at any of them for a whole example. The Gallery is the plainest.

This guide says how to build a showcase, and what this folder,
`@mvtjs/site-kit/showcase`, holds for you to build one with. How the page
runs a showcase, from the nav's Browse menu to the entries it launches, is
in [the page's README](../arcade/README.md#11-the-showcase-the-other-way-to-browse).

## Where It Lives

A showcase is a folder of the site's own, `src/showcase/`, beside
`src/entries/`. It's laid out as an entry is, with `data/`, `models/`,
`views/` and `start/`. It isn't in the catalogue. The site's config names
it instead.

```ts
export const SITE: SiteConfig = {
    // ...
    catalogue: CATALOGUE,
    showcase,
};
```

`start/showcase.ts` describes it, as an entry's `start/entry.ts` does, with
an `ArcadeEntry`. So the parts of the site kit that show and start entries
show and start it too. You get these for free:

- its info panel, which the nav's (i) opens while the showcase shows, with
  its long text from `start/details.ts`, How to Play first;
- its link preview, at its own address (`demos/gallery/`, say), which opens
  the site on the showcase, from its `start/share.png` or `share.jpg`;
- its pictures, which `generate-thumbnails` photographs as it does an entry's;
- its whole screen, drawn at its thumbnail moment in the site's
  `canvas-entries` visual test.

Its id isn't its folder's name, as an entry's is, so the build reads it from
`start/showcase.ts`. The catalogue tests check the showcase isn't listed,
and that its long text says how to walk round.

## Its Starter

`start/load.ts` returns an `EntryStarter`, as an entry's does, so the
page's entry host runs it unchanged. The page passes it a `launcher` as it
starts. A showcase declares `draws3d: true`.

**Fill the area.** A showcase fills the area under the nav, as the card
wall does, so it lays itself out. Give its starter a `fitTo`, and its
description `laysItselfOut: true`. It keeps its own height, and is as wide
as the area's shape needs (`fitShowcaseWidth`). Its views read the width as
it changes, rather than being built again, since its screens hold entries
that keep running.

**Launch the entries.** `launcher.launch(id)` launches an entry, as a card
does, but without a way in. The entry plays over the showcase, exactly
where the showcase drew its screen. `launcher.playRectFor(id)` returns where
that is, in the showcase's own pixels. `launcher.launchedId()` turns
undefined once the visitor has left the entry, so the showcase can step them back. An
entry on the same kind of sound chip as the showcase stops the showcase's
sound, so start your music again then, if you have any.

**Let the visitor use an entry in place.** An entry on a screen can receive
the pointer while the visitor stands at it, so they can press its buttons
and drag its sliders without stepping up. A Pixi entry's screen receives
pointer events in the scene, and passes each one on to the entry's own
stage. An entry that draws with the DOM runs in a box of HTML on the
showcase's overlay. A view lays the box over its screen in perspective, and
the browser delivers its events itself. Every entry on a screen, and every entry the
showcase launches, starts with `launchedBy`, the showcase's id. So one that
would reload the page to restart, as Falling Sand does when a switch
changes, restarts in place.

## Hide Something

Each showcase has an easter egg, found rather than pointed out. The Arcade
Hall's last hall has a button that leads outside, to a meadow, and holding
the primary button there goes back in. The Gallery's door leads to a dark
room of lanterns that rise round the visitor. The newspaper's back page has
noughts and crosses pencilled in its margin, against a player you never
see. A new one should follow the
[originality rules](../../../arcade/src/entries/README.md#originality), as
everything in the sites does.

## The Parts

What the three showcases share is here. Only a showcase's own code imports
it, because it imports PixiJS 3D.

- `createWalkerModel` is someone walking round a 3D scene, for a
  first-person view. The showcase's model keeps them out of the scene's
  walls and furniture with `pushOutOf` and `keepInside`, and finds what's in
  reach with `distanceToUse`.
- `createLiveEntriesHost` runs the entries on their screens. The few
  nearest the visitor run silently in attract mode, and an attract pilot
  plays a game that uses the arcade controls. Given the page's overlay
  (`PixiStartBase.overlay`), it runs an entry that draws with the DOM in a
  box on it. Without the overlay, such an entry's screen shows its picture.
  The host also launches the entry the visitor has stepped up to, through
  the launcher, and reports when they have left it.
- `placeScreen` works out where a screen is, and how big, for its entry's
  shape. `frameScreen` works out where the camera stands so that the screen
  fills the rectangle where the page will play its entry, which the host's
  `playRectAt` returns. Glide the camera there as the visitor steps up, and
  the launched entry lands exactly on its screen.
- `fitShowcaseWidth` is the width a showcase lays itself out to, for the
  area it's given.
- `WalkerCameraView` is that camera, for a walker. `LiveScreenView` shows a
  running Pixi entry on a screen. The screen is a `ScreenView`, from
  `@mvtjs/pixi-3d`, which forwards pointer events to the entry while the
  screen is interactive. `LiveElementView` lays an entry that draws with
  the DOM over its screen. `LookDragView` holds the scene and looks round
  as the visitor drags, unless a screen handles the press. `ShowcaseHudView`
  draws a line of help.

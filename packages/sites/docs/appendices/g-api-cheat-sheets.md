# API Cheat Sheets

> The APIs you'll reach for most as you build a game with MVT and this
> book's libraries, arranged by what you're trying to do rather than by
> package. Each entry says when you'd use the API, and gives its signature,
> its import line and the chapter that teaches it. The playground shows the
> same sheets beside your code, and so does each experiment online.

**Related:** [MVT on One Page](a-mvt-on-one-page.md) ·
[Glossary](b-glossary.md) ·
[Troubleshooting](f-troubleshooting.md)

Each sheet covers one job, such as noticing a change or playing a sound,
whichever library its APIs come from. The signatures, and the first
sentence of each description, are read from the libraries' own
declarations as the book is built, so they always match the code. The
libraries' doc comments say more, and so does the chapter that each entry
links to.

::: info In this book
The sheets cover the `@mvtjs` libraries, the playground's `playground`
module and the `audio90` sound chips, and the parts of Pixi, three.js and
GSAP that the book's examples use. MVT itself needs none of them. The view
tick API, such as `setRefresh`, is exported by each renderer's package:
`@mvtjs/pixi`, `@mvtjs/html` and `@mvtjs/three`. The sheets show the import
from `@mvtjs/pixi`, so import it from your own renderer's package instead.
In the playground, press Cheat sheet, or F1, to open the sheets over the
run, beside your code. In an experiment, press View code, then Cheat sheet.
:::

## Defining a Project in the Playground

<CheatSheet id="your-project" />

## The View Tick API

<CheatSheet id="the-tick" />

## Watching for Changes

<CheatSheet id="watching-for-changes" />

## JSX for Pixi

<CheatSheet id="pixi-jsx" />

## JSX for HTML

<CheatSheet id="html-jsx" />

## JSX for three.js

<CheatSheet id="three-jsx" />

## Time and Motion Helpers

<CheatSheet id="time-and-motion" />

## Slot Lists for Collections

<CheatSheet id="collections" />

## Sound on the Audio80

<CheatSheet id="sound" />

## Pixi Essentials

<CheatSheet id="pixi-essentials" />

## three.js Essentials

<CheatSheet id="three-essentials" />

## GSAP Essentials

<CheatSheet id="gsap-essentials" />

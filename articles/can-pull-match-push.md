# Can pull match push? A Look at `<List>`s

You have a list of todos. You render it. The user adds one.

Now what?

The dumb answer is to throw away every DOM node and build new ones. It works.
It is also a catastrophe, and not because JavaScript is slow. Browsers do a
startling amount of work per node: style resolution, layout, paint,
compositing. Touch enough of them and you will spend eight milliseconds
reflowing a page where one word changed.

Worse, you will have destroyed things nobody told you were there. The text
input the user was halfway through typing. Its cursor position. Their
selection. The scroll offset of the div. Focus. A half-finished CSS transition.
None of that lives in your data. It lives in the nodes, and you just deleted
them.

So frameworks don't do the dumb answer. They diff.

## The thing web frameworks got right

Hand a modern framework a `key` for each row and it will do something genuinely
clever. It keeps a map from key to node. When the array changes, it walks the
new keys, reuses the node for every key it has already seen, builds nodes for
keys it hasn't, and drops nodes whose keys are gone. Then it computes the
minimum set of moves to get them in the right order, usually via a longest
increasing subsequence, because moving a DOM node is not free either.

Swap two rows in a thousand-row table and a keyed reconciler will move exactly
one node and rebuild nothing. Reverse the whole list and it will still rebuild
nothing. Your text inputs keep their cursors. Your transitions keep running.

I want to be clear about this because the rest of this post is going to sound
like I'm picking a fight: that is a very good piece of engineering, and it is
the correct answer to the problem it is solving.

And the reason it's correct is worth saying out loud. In a web app, **nothing
is happening.** Not most of the time. Almost all of the time, literally
nothing. The page sits there. Then a user clicks something, and for about four
milliseconds there is work to do, and then nothing is happening again.

When that's your world, you want work proportional to *the change*, not to the
scene. You want to be told when something happens, so you can sleep the rest of
the time. That's push. You push a state change into the system, the system
figures out the smallest possible patch, and the other 99.99% of the time
your CPU is idle and your laptop fan is off.

Reconciliation is what "smallest possible patch" looks like when the thing
you're patching is a tree.

## Games are weird about this

Two words before I go further, because the rest of this depends on them.

**Push** means: something changed, so notify whoever cares. **Pull** means:
it's time to draw, so go ask everyone what they look like now.

Web UI is overwhelmingly push. Games are overwhelmingly pull, and they are
shameless about it.

Consider what a game does sixty times a second. It takes roughly two million
pixels and throws all of them away. Then it computes two million new ones from
scratch. Nobody writes a renderer that asks "is this pixel the same colour it
was last frame? Then let's skip it." That code does not exist. If you proposed
it at a graphics meetup people would look at you with real concern.

Why not? Two reasons.

The first is that something is always changing. The camera drifted half a pixel
and now every single pixel on screen is different. Change is not rare and
bursty, it's constant and total. A system optimised for "usually nothing
happens" has nothing to optimise.

The second is subtler and it's the one that matters here. **Checking whether
something changed costs about as much as just doing it.** Comparing two colours
costs a compare. Writing a colour costs a write. Once the work per item gets
small enough, the bookkeeping to avoid the work costs more than the work.

Games discovered decades ago that past a certain point, recomputing everything
unconditionally is not the lazy option. It's the fast one. It's also the one
with dramatically fewer bugs, because a system that recomputes everything can't
get out of sync with itself.

So here's the question this post is about: what happens if you take that
attitude and point it at a list?

## A `<List>` that doesn't know what's in it

I've been working on a thing called MVT, which stands for Model-View-Ticker.
You need three sentences of it to follow along.

Models own all the state and only advance through `update(deltaMs)`. Views read
state through plain getter functions and refresh every single frame, no
exceptions. A ticker drives the whole thing in a loop, the way a game loop
always has.

There's a JSX runtime for it, `mvt-jsx`, which builds a real scene graph once
and never diffs it. Props that are plain values get set at construction. Props
that are functions get called every frame:

```tsx
<sprite texture={shipTexture} x={() => ship.x} y={() => ship.y} />
```

That's the entire reactivity model. No signals, no observers, no dependency
graph. Every frame, call the function, write the result. If you're coming from
the web this looks like a performance crime. In a loop that's already running
sixty times a second to move a spaceship, it's just Tuesday.

Which brings us to lists. Here is the whole API:

```tsx
<List length={() => model.bulletCount}>
    {(index) => (
        <sprite
            texture={bulletTexture}
            x={() => model.getBullet(index).x}
            y={() => model.getBullet(index).y}
        />
    )}
</List>
```

Look at what isn't there.

There's no `items` array. No `key`. No diff. The list is never told what the
items *are*. It is told how many there are, and how to build the thing that
goes in slot `N`.

Slot 5 renders whatever the model holds at index 5. Not "the bullet that was
there when we built it." Whatever is there *right now*, re-read this frame, and
re-read again next frame. The slot is a window onto a position in the array,
not a handle on an object.

When the length grows, the list appends. When it shrinks, the list detaches the
extras and keeps them in a pool. That's it. That's the component.

The first time I wrote this down I assumed I'd missed something obvious. So I
described it to an AI assistant, which patiently explained reconciliation to me,
recommended I add keys, and cited React's documentation on why index-based lists
are a known anti-pattern.

Which is fair! It has read approximately every blog post ever written about web
frameworks, and in that corpus this idea is straightforwardly wrong. It's a bit
like asking a very well-read friend about throwing away two million pixels a
second. Every book they've read says don't do that.

## Is it as bad as it sounds?

Let's take the case that should kill it. Your model has a `swap(a, b)`. You
call it.

A keyed reconciler handles this beautifully: one node moves, nothing rebuilds,
every node keeps whatever state it was holding.

The index-addressed list does something stranger. It does **nothing at all.**
The length didn't change, so there is no structural work to do. No moves, no
rebuilds, not even a comparison beyond checking one integer.

And the screen is correct on the very next frame. Slot A re-reads the array and
finds item B there, so it draws item B. Slot B finds item A. Every binding was
going to be re-read anyway, so the "wrong" mapping fixes itself before anyone
sees it.

This is the actual insight, and it's not about lists at all:

> Under pull, a wrong item-to-view mapping is self-correcting for anything
> that is a binding.

Reconciliation exists because, under push, a wrong mapping produces output that
is wrong and *stays* wrong, since the framework only writes on diff. Take away
that premise and most of reconciliation's job evaporates. Not all of it. Most.

So what's left? What doesn't get re-read?

Anything the view is holding that didn't come from the model. A half-finished
fade. A smoothed position. An animation playhead. A hover state. The stuff that
lives in the node and nowhere else.

That is exactly the stuff reconciliation protects, and index addressing will
happily hand it to the wrong item.

### Where it actually goes

Here's the fix, and it took me embarrassingly long to see it because I kept
thinking about the list.

Put the per-item presentation state in a view model, keyed by item id, and have
it republish results per slot each frame.

```ts
// Cosmetic state per item, indexed by dense integer id.
const cosmetics: TileCosmetic[] = [];

// Republished per slot, so each view binding is one array read.
const slotX: number[] = [];

function update(deltaMs: number): void {
    const ease = 1 - Math.exp(-EASE_RATE * deltaMs / 1000);

    for (let i = 0; i < count; i++) {
        const cosmetic = cosmetics[getTileId(i)];

        // Ease toward whichever slot this tile now occupies.
        cosmetic.x += (slotTargetX(i) - cosmetic.x) * ease;
        slotX[i] = cosmetic.x;
    }
}
```

I built a demo with two rows of tiles driven by one model whose only mutation is
`swap`. The rows are identical except for one line: whether the cosmetic state
is keyed by slot or by item id.

Keyed by slot, a swap makes the labels jump. Slot 3's eased position is already
sitting exactly at slot 3, so there is nothing for it to animate. Slot-keyed
state cannot see a reorder at all.

Keyed by item, the tiles slide past each other. Nothing detects the swap.
Nothing has a special case for it. Each tile is simply easing toward a
different number than it was last frame, so it travels there.

And here's the part that made me stop arguing with myself: **a keyed reconciler
would not have saved you this work.** It preserves the node's identity across a
reorder, but not the node's *position*. The node teleports to its new slot
unless you add an easing layer on top. Which is this easing layer. You write it
either way.

## "But what about..."

Good. Here are the objections I'd raise, and what I actually think of them.

**"This is just unkeyed lists, which React explicitly warns against."**

Structurally, yes. The difference is that React's warning is about a system
that *doesn't* re-read. There, a wrong mapping is permanent. Here everything is
re-read every frame, so the failure mode React is warning you about doesn't
occur.

But the warning isn't entirely defused, and I want to be straight about that.
It applies precisely to everything that isn't a binding: pointer capture
mid-drag, an animation playhead, focus. In a DOM, that list is long and
includes things users notice immediately. On a game canvas it's short. That
difference is doing a lot of work in my argument, and if you're building a form
you should weight it accordingly.

**"You said reconcilers have to guess. They don't."**

They don't, and I was wrong to say it. I wrote that sentence, liked it, and
repeated it for a while before actually testing it.

A keyed reconciler is fully deterministic. Given a key function, the
item-to-node mapping is completely determined by the current array. There's no
inference, no heuristic, no reconstruction of what happened. I wrote a minimal
one to check: a `Map`, one pass, about 35 lines, zero rebuilds on every reorder
I threw at it.

Guessing only shows up in *bounded heuristic* reconcilers, the kind that check
for a single insertion or a single deletion and give up after that. Those do
encode assumptions about how your list mutates. But that's a criticism of one
implementation, not of the technique.

Related confession: the heuristic reconciler I'd written had a bug where the
write cursor ran ahead of the read cursor and clobbered entries it hadn't
compared yet. A single insertion at the head of a twenty-item list rebuilt all
twenty-one. I found it by measuring, not by reading, having read that function
several times without noticing. Reconcilers are subtle. That's a point against
writing one casually, not a point against reconciliation.

**"The model knows best how items move, so the list shouldn't have to infer it."**

I liked this one a lot, and it dissolves under scrutiny. A `key` prop *is* the
model telling the list about identity. Taken to its conclusion, the argument
asks for exactly what every keyed reconciler already asks for.

**"Your O(n) to O(1) saving is a rounding error."**

Largely, yes. A keyed reconciler still compares `n` keys per frame to learn
nothing changed, and the index-addressed list compares one integer. At two
thousand items that's a couple of thousand cheap comparisons saved, against
per-item refresh work that dominates the frame anyway. It's real. It's not
transformative, and I shouldn't have led with it.

**"What about lists where items have different shapes?"**

You need a second construct. Index addressing can vary a slot's *contents* but
not its *structure*, so `mvt-jsx` has a `<Switch>` that picks a subtree by key
and retains each branch once built. Without it, the simpler `<List>` genuinely
cannot express things the reconciling one could. That's a real gap, filled by a
real piece of additional machinery, and I'd rather count it honestly than
pretend the simpler design came free.

**"Polling every frame is going to eat my battery."**

Correct, and this is the honest boundary of the whole approach. If your UI is a
document that sits still until someone touches it, do not spin a sixty-hertz
loop to watch it not change. Push is right for that, decisively.

MVT is for things already running a loop for other reasons. If a render is
happening anyway, polling is nearly free, because you're adding a function call
to a frame you were going to spend regardless. If a render is *not* happening
anyway, you've just invented a reason for one, and that reason is bad.

**"Detached slots pile up."**

They do. The list keeps a high-water mark, so a list that peaked at five
thousand items holds five thousand slots. They're inert, but they're resident.
There's a `trim()` for when you care. Mostly you won't, but it's a cost, not a
non-cost.

## So, can pull match push?

Not exactly. It changes what the question is.

Push spends effort finding the smallest possible patch, and that's the right
trade when almost nothing is happening almost all of the time. Pull spends no
effort on that at all, and that's the right trade when something is always
happening and the per-item work is small enough that checking costs as much as
doing.

What surprised me is how little the list turned out to be the interesting part.
The real question was never "how does the list track identity." It was **where
identity-keyed state should live**: in the scene graph, or in data.

A reconciler answers "in the scene graph," and then has to work fairly hard to
keep the scene graph in the right shape so the state stays attached to the
right thing. MVT answers "in data," mostly because views are supposed to be
thin projections you can test without a renderer. But once that state is in a
plain array in a view model, the scene graph has no remaining reason to know
which item is which. And a list that doesn't need to know which item is which
doesn't need to reconcile.

The simpler `<List>` isn't clever. It fell out of a decision made somewhere
else entirely, for unrelated reasons, and it only looks radical if you come at
it from a direction where that decision went the other way.

Which is most directions, admittedly. Including, apparently, every blog post an
AI has ever read.

Though in fairness to the machine: it only told me what I'd have told me, five
years ago, with rather more confidence and a worse haircut.

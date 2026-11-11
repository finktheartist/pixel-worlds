# Sigil

A loading spinner that is a summoning circle cut into a dark stone floor, and the only light in it is a will-o'-wisp. With no value, the wisp circles the ring. The stone shows only where it is: the grooves catch its light and throw shadows, and each rune it passes ignites and cools behind it. Give it a value and it is a progress ring: the runes stay charged one by one, clockwise from the top. At 100% the wisp spirals into the middle and flares, the floor answers, and a hooded, horned figure climbs out of it and takes the light in its hand. Then it is quiet.

One of six in this repo. Same idea in each (the control's value changes a pixel world), different control: this one is a spinner you can drop in next to a button or in a card. It is lit the way the grim cut of Round's tavern is: dark, with a few things giving light.

## Run it

```sh
python3 -m http.server 8000     # from the repo folder
# open http://localhost:8000/sigil/
```

Two files: `sigil.js` is the component and `index.html` is a page that shows it. Vanilla JS and Canvas2D, no dependencies, no network requests, no sound.

The page plays a made-up task on a loop: about two and a half seconds with no number (a plain spinner), then a load with a stall in the middle, then the answer, then it starts again. It shows the spinner twice: at twice its own size, and at its own size in a card beside a button.

- `?p=0.4` holds it at 40%, `?p=spin` is a plain spinner, and `?p=1` is the settled answer.
- `?embed=1` hides the heading and the hint, for showing it inside another page. The gallery uses it.
- `?film=1` stops the clock and steps the task one frame at a time (11.5 seconds), and `&seek=7.5` jumps to a moment in it.

## Use it

`sigil.js` is the whole component: one file, no dependencies. Copy it into a project and:

```html
<script src="sigil.js"></script>
<sigil-spinner label="Loading the map"></sigil-spinner>
```

```js
const el = document.querySelector('sigil-spinner');
el.set(0.37);       // the task's progress, 0 to 1, as often as you like
el.set(1);          // finished: the circle flares and something answers
el.set(null);       // back to a plain spinner
el.addEventListener('sigil:done', () => { /* the circle has been answered */ });
el.reset();         // clear the done state and go back to a plain spinner
el.value;           // the progress it is showing, 1 once done, or null while it only spins
el.done;            // true once it has fired
```

| attribute | what it sets | default |
|---|---|---|
| `value` | progress, 0 to 1. Without a number it is a plain spinner. | not set |
| `label` | what a screen reader calls it | Loading |
| `done-label` | what a screen reader is told when it finishes | Done |

- **No value is a spinner, a value is a progress ring.** `value` and `set()` do the same thing. `set()` does not write the attribute. A value that is not a number is a plain spinner.
- **It eases toward the number.** A jump from 10% to 60% is walked, at a fixed speed, so each rune gets its turn. `el.set(0.4, true)` goes straight there. `el.set(1, true)` goes straight to the settled answer.
- **`sigil:done` fires once,** when the circle reaches 100% on screen, which is a moment after you set 1. It bubbles. A plain spinner never fires it.
- **Once done, it stays done** until `reset()`, whatever `value` says. `reset()` also removes the `value` attribute.
- **The wisp keeps circling at any value,** including 0, so a stalled task still looks alive. Only the lit runes say how far it has got.
- **Size:** 97 by 97 CSS pixels, round, with clear corners, and it sits inline (`vertical-align: middle`). Set a CSS width on the element to resize it; it stays square. A multiple of 97 (97, 194, 291) keeps the art pixels even. The demo page uses 97 in the card and 194 for the big one. Below 97 the picture is shrunk by the browser and the dither goes soft.
- **Not interactive.** It is not a button and has no tab stop. Inside is a `role="progressbar"` with `aria-label`, `aria-valuemin` and `aria-valuemax`. `aria-valuenow` is there only while there is a value, so a plain spinner reads as indeterminate. When it finishes, `aria-busy` goes false and the done label is written to a `role="status"` element.
- **More than one on a page works.** They share one painter and one animation loop. Each starts the wisp at a different place.

To step it from a script, the way the film does:

```js
const Sigil = customElements.get('sigil-spinner');
Sigil.paused = true;      // stop the clock
el.set(0.5);
el.advance(1 / 60);       // one frame on
el.advance(0.5);          // half a second on
```

## What happens

| it is | you see |
|---|---|
| a plain spinner | the wisp goes round once every 1.6 seconds, with a tail of the places it has just been and sparks that come off it. The floor is nearly black except round it. Each rune it passes ignites white-teal and cools over most of a turn behind it |
| at 0% | the same wisp, and no rune charged |
| at 40% | the first six runes charged and the seventh half charged, glowing in their grooves, clockwise from the top. The wisp circles over them, and every charged rune is brightest while it is near |
| at 100% | all sixteen charged, then the wisp spirals in to the middle, faster as it goes |
| the answer | the wisp flares and the whole circle blazes. A ring of light goes out across the floor. Mist rises, and the figure climbs out of the floor, with its eyes opening white and then ember. The wisp drifts to its hand |
| done | the runes bank down to a steady glow. The wisp rests at the figure's hand and lights its edges and the floor round it. The figure blinks now and then. Dust drifts through the light |

The charged runes come from one number, the progress, so the runes and the percentage cannot drift apart. The wisp, its flicker, the sparks, the dust and the blinking run on the clock, so if a task stalls the wisp keeps going.

## How it's built

- **A height map, lit per pixel.** The stone is baked once as a height map (flagstones laid in running bond, each a little domed, with joints, cracks and pits, a raised lip round the edge, then the circle cut into it), an albedo, a shine and the normals. Every frame the wisp is put on it as one point light: soft falloff, a sharp edge on each groove on the side that faces it, a short shadow behind each groove and lip, and a glint on damp stone. This is why the floor changes as the wisp passes, and why the rings, the star and the runes only show near it.
- **One light.** There is no other lamp. Charged runes glow in their own grooves, brightest near the wisp, and bleed a little into the stone round them; they light nothing. Dust motes show only where the wisp's light catches them. The eyes are ember and light nothing.
- **The circle.** Two rings with a dial of 48 ticks between them, sixteen runes (a few straight strokes each, turned to stand out from the ring and made up, so none is a letter), an inner ring, a five-pointed star with a ring at each point, and a well in the middle.
- **The figure** is painted once at 36×40, smooth: a hooded cloak, two long horns, a face that is a dark hollow, an arm held out. Its height comes from its own outline, so the wisp finds its edges and folds. It is lit by the same light as the floor. It rises through a line at its hem, so whatever is below the floor is not drawn and nothing is scaled.
- **Crush.** The lit frame is mapped to one of 40 colours with a 4×4 ordered dither, then drawn at 4 canvas pixels to each art pixel so it is exact at 1x, 2x and 3x screens. The corners are clear.

It cost about 0.85 ms a frame in headless Chrome, in every state. Six of them on one page ran at 60 fps there.

## Limits

- **One size, one look.** There is no light-theme variant and nothing for a failed task. `reset()` only puts it back to a spinner. If a task can fail, show the error next to it.
- **It is dark on purpose.** Away from the wisp the floor is close to black, so on a dark page the disc is just a darker disc. Progress is carried by the charged runes, which glow on their own, and not by the stone.
- **No text.** There is no percentage drawn in it. The page around it can say one.
- **The weak frames.** The flare is a bright wash for a fifth of a second and the stone loses its detail in it. The left horn of the figure is in the dark when the wisp rests at its right hand, so only the right one shows. The figure's hand is hard to see, so "it takes the light in its hand" is more a matter of the wisp coming to rest beside it. At the sizes below 97 pixels it gets mushy.
- **The figure is front-on over a top-down floor.** It stands on the circle rather than rising out of the plane of it.
- **Going backwards is plain.** If the value falls, the runes go out in reverse. If it goes back to no value, the charged runes cool as the wisp's own tail takes over.
- **Motion is always on.** It does not change for `prefers-reduced-motion`.
- **Checked in headless Chrome only.** Read frame by frame, and run at real speed for a few seconds to count frames. Not tried in Safari or Firefox, on a touch screen, or with a screen reader. There is nothing to press, so there was no pointer or keyboard behaviour to test; it has no tab stop.
- **No clip yet.** `?film=1` runs the task, but nothing has been rendered from it.
- **Not on npm, and not a module.** It is a plain script that registers the element when it loads.

## A clip

`?film=1` stops the clock and steps the task one frame at a time, which is what the capture script needs. This frames the spinner and the card on a 1080 square. It has not been run on this version.

```sh
W=1080 H=1080 URL='http://localhost:8000/sigil/?film=1' OUT=sigil.mp4 node film/render.mjs
```

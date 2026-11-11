# Sigil

A loading spinner that is a summoning circle on a dark stone floor. With no value, a will-o'-wisp circles the ring and the runes it passes light up and fade behind it. Give it a value and it is a progress ring: the runes light one by one, clockwise from the top, and stay lit. At 100% the wisp spirals into the middle, the circle flares, and an imp climbs out of the floor and waves. Then it is quiet.

One of six in this repo. Same idea in each (the control's value changes a pixel world), different control: this one is a spinner you can drop in next to a button or in a card.

## Run it

```sh
python3 -m http.server 8000     # from the repo folder
# open http://localhost:8000/sigil/
```

Two files: `sigil.js` is the component and `index.html` is a page that shows it. Vanilla JS and Canvas2D, no dependencies, no network requests, no sound.

The page plays a made-up task on a loop: about two and a half seconds with no number (a plain spinner), then a load with a stall in the middle, then the answer, then it starts again. It shows the spinner twice: at its own size, and at half that size in a card beside a button.

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
- **Size:** 82 by 82 CSS pixels, round, with clear corners, and it sits inline (`vertical-align: middle`). Set a CSS width on the element to resize it; it stays square. A multiple of 41 (41, 82, 123, 164) keeps the art pixels even. The demo page uses 41 in the card.
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
| a plain spinner | the wisp goes round once every 1.5 seconds, with a tail of the places it has just been. The runes it passes light, and fade over most of a turn behind it |
| at 0% | the same wisp, and no rune lit |
| at 40% | the first five runes lit from the top, the sixth half lit, and the wisp circling over them. Each lit rune flares as the wisp goes past |
| at 100% | all twelve lit, then the wisp spirals in to the middle |
| the answer | a ring of light goes out, the floor flashes, a pillar of light goes up, and the imp climbs out of it with his eyes lit white. He waves (the hand goes up and down), then stands |
| done | the runes are steady. The star in the middle dims. The imp blinks now and then and flicks his tail. His eyes are ember |

The lit runes come from one number, the progress, so the runes and the percentage cannot drift apart. Only the wisp, its flicker, the blinking and the tail run on the clock.

## How it's built

- **Paint, then crush.** The scene is painted at 41×41, lit, then every pixel is mapped to one of 36 colours with a 4×4 ordered dither. It runs every frame through a lookup table, then is drawn at 6 canvas pixels to each art pixel, so it is exact at 1x, 2x and 3x screens.
- **The floor is baked once.** A round flagstone with a bevelled rim, a few cracks, two rings cut into it, a pentagram, and twelve runes. Each cut is a dark line with a pale lip on its lower right. The runes are made up (a few straight strokes each) so none is a real letter.
- **One light: the wisp.** It throws a small pool of teal on the stone, in two flat rings so it does not speckle. A second, steadier light in the middle grows with the progress. Lit runes, the wisp and the flare are drawn after the light, so they never go grey.
- **Runes are 3×5 and upright,** placed on the ring a pixel at a time and never rotated. Each lit rune gets a stepped glow one pixel out.
- **The imp is a shape,** 11 pixels wide and 14 tall, dark against the glowing floor. Horn tips and eyes go on after the light so they stay exact. He rises through a line at his feet: whatever is below it is not drawn, so he comes up out of the floor with nothing scaled.
- **The corners are clear.** The picture is cut to a stepped circle, so it sits on a light page or a dark one.

It cost about 0.15 ms a frame while spinning and about 0.35 ms in the done state, in headless Chrome. Fourteen on one page ran at 60 fps there.

## Limits

- **One size, one look.** There is no small, large or dark-on-light variant, and nothing for a failed task. `reset()` only puts it back to a spinner. If a task can fail, show the error next to it.
- **At 41 pixels the wisp is small.** It still reads as a bright dot with a tail, but the runes are the clearer signal at that size, and the imp is a dark shape with two eyes.
- **No text.** There is no percentage drawn in it. The page around it can say one.
- **The weak frames.** The flash at the moment of the answer is a flat pale disc for about a fifth of a second. The imp's horns are a few pixels, and his tail runs into his raised arm while he waves. The wave is a one-pixel movement of the hand.
- **The imp is front-on over a top-down floor.** He stands on the circle rather than rising out of the plane of it.
- **Going backwards is plain.** If the value falls, the runes go out in reverse. If it goes back to no value, the lit runes fade as the wisp's own tail takes over.
- **Motion is always on.** It does not change for `prefers-reduced-motion`.
- **Checked in headless Chrome only.** Read frame by frame, and run at real speed for a few seconds to count frames. Not tried in Safari or Firefox, on a touch screen, or with a screen reader. There is nothing to press, so there was no pointer or keyboard behaviour to test; it has no tab stop.
- **No clip yet.** `?film=1` runs the task, but nothing has been rendered from it.
- **Not on npm, and not a module.** It is a plain script that registers the element when it loads.

## A clip

`?film=1` stops the clock and steps the task one frame at a time, which is what the capture script needs. This frames the spinner and the card on a 1080 square. It has not been run on this version.

```sh
W=1080 H=1080 URL='http://localhost:8000/sigil/?film=1' OUT=sigil.mp4 node film/render.mjs
```

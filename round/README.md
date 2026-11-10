# Round

A loading bar that is the bar of a tavern. Seven regulars sit along it: two dwarves, an elf, a wizard, a knight and two hobbits. As the task loads, each one in turn picks up their drink and empties it. At 100% the empties go up together and come down hard.

One of four in this repo. Same idea in each (the control's value changes a pixel world), different control: this one is a progress bar.

## Run it

```sh
python3 -m http.server 8000     # from the repo folder
# open http://localhost:8000/round/
```

Two files, `index.html` and `app.js`. Vanilla JS and Canvas2D, no dependencies, no network requests, no sound.

Left alone, the page plays a demo load on a loop, with one stall in the middle. Click the bar to replay it.

- `?p=0.4` holds it at 40%.
- `?film=1` is the frame-stepped mode the clip is rendered from.

## Drive it from a real task

```js
round.set(0);        // call this first: it stops the demo
round.set(0.37);     // any value from 0 to 1, as often as you like
round.set(1);        // the empties go up and come down
```

The bar eases toward the value you give it, so a jump from 10% to 60% still gives each drinker a turn. The canvas is a `role="progressbar"` and `aria-valuenow` follows the value.

It is still a demo page, not a packaged component: one bar per page, sized to the window.

## What happens

| progress | what you see |
|---|---|
| 0% | seven full cups on the bar, three candles, the hearth |
| each seventh | the next drinker reaches, lifts, tips it back, puts it down empty |
| a stall | whoever is mid-drink keeps swallowing until the number moves |
| 100% | the empties go up in a wave, hang, and slam down left to right; the candles duck and the rail flares |

Everything a drinker does is worked out from the progress number, so the drinking and the percentage cannot drift apart. Only the swallowing, the blinking, the fire and the smoke run on the clock.

Each drinker starts reaching a little before the one beside them has put theirs down, so the motion passes along the bar without a gap.

## How it's built

- **Paint, then crush.** The scene is painted smooth at 476×160 and then every pixel is mapped to one of 49 colours with a 4×4 ordered dither. The mapping uses a lookup table, so it runs on every frame.
- **Light is multiplied in.** Each figure is painted in its own colours on its own layer, then multiplied by a light map: a cold dark ambient plus the three candles, the hearth and the moon through the window. Things that glow (eyes, the pipe, the staff) are put back afterwards. The hobbit in front of the fire gets almost no light from the front and a bright rim instead.
- **The cup leads.** Each drinker has a cup with three positions: on the bar, at the mouth, held up. The hand stays on the grip, the elbow swings around the shoulder, and the head tips to meet it.
- **Seven cups.** Oak tankard, silver beaker, clay mug, lidded stein, drinking horn, steel goblet, dented tin cup.
- **Still poses are cached.** A figure that is waiting or finished is drawn once and reused. Only whoever is moving is repainted and re-lit.

It costs about 2 to 5 ms a frame in headless Chrome, and about 8 ms while all seven are moving at the end.

## The clips

Both use the capture script in `film/`, and both are 60 fps and silent.

`round.mp4` is the bar on its own: 16.8 s, 1080×540.

```sh
W=1080 H=540 URL='http://localhost:8000/round/?film=1' OUT=round/round.mp4 node film/render.mjs
```

`round-x.mp4` is the square cut for X: 17.8 s, 1080×1080, framed the same way as the Keep clip. The whole bar sits in a card on a page. A cursor comes in and presses "Run the task", the load runs with one stall (the state under the bar reads STALLED while the berserker keeps drinking), and the cursor leaves before the empties come down. It has one opening caption ("a loading bar that is a bar") and an end card ("ROUND, the bar fills as they empty").

```sh
W=1080 H=1080 URL='http://localhost:8000/round/?film=1&x=1' OUT=round/round-x.mp4 node film/render.mjs
```

`?x=1` on its own plays the square cut live.

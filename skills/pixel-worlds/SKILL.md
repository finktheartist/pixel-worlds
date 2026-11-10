---
name: pixel-worlds
description: Build or change a UI control that has a small living pixel-art scene inside it, where the control's value drives the scene (a hold-to-delete button that is a dragon, a status chip that is a wizard at his desk). Use when asked to make a new one, re-theme one, add a state to one, or wire one into an app. Covers the painter kit, the pixel rules, and the frame-by-frame review that has to happen before calling it done.
---

# Pixel worlds

A pixel world is an ordinary control (a button, a slider, a status line, a password field) with a scene inside it that the control's value changes. The scene is painted in code. There are no image files.

This skill is the workflow those were made by. It comes with three files:

- `kit.js` — the painter: layers, light, the palette crush, a pixel font, a two-bone arm, a clock you can stop.
- `starter.html` — the smallest whole example, a lantern switch. Copy it to start a new one.
- `look.mjs` — steps an animation to chosen moments and saves the frames side by side, so you can read them.

If the job is only to put an existing component into an app, skip to **Wire it in** and **Check it**.

## 1. Decide four things before painting

1. **The control.** What ordinary control is this? It must still work as that control with the scene ignored.
2. **The one number.** Everything the scene does comes from one value (how far through the hold, progress, strength, which state). Only ambient things run on the clock: flicker, blinking, smoke. If two things can drift apart, they will.
3. **The size.** Pitch it at a size someone could drop into a real interface: a button is button-sized. A wide scene strip is a showpiece, not a component.
4. **Who is in it and what they visibly do.** Use the classic version of the character, not a twist on it. Each state should be readable with the label covered.

## 2. Paint, light, crush

Every frame goes through the same three steps. `starter.html` shows all of them in forty lines.

1. **Paint smooth, in true colours, on layers.** Work at the art's own size (the examples are 96 to 200 pixels wide). Paint each thing with ordinary Canvas2D on its own `k.layer()`, in the colours it would be in daylight. Paint the things that never move once and stamp them down.
2. **Multiply by the light.** Say what gives light in this frame as a cold ambient plus point lights, and `k.lit(layer, S)` each layer. Add `k.rim()` on the edge that faces the light. Anything that glows (a flame, an eye, a spark) is drawn after, straight onto the canvas, so the light never dims it.
3. **Crush.** `k.crush()` snaps every pixel to a fixed palette with a 4×4 ordered dither. Lettering and other exact pixels go on after the crush.

One light is better than several. Let the control change the light, so the whole scene reacts.

Three things about the light that are easy to get wrong:

- **Multiplying can only darken.** A surface comes out as its own colour times the light, so under a dim ambient a pale prop goes grey. Either give it a light, or draw it after the light with the things that glow.
- **A wide soft light speckles flat areas.** A slow falloff across a flat wall or sky crushes to a broad band of dither. Keep lights tight, leave the sky unlit, or lower `spread` when you make the kit.
- **A rim has a direction.** `k.rim(L, -1.2, 0, ...)` lights right-hand edges and `k.rim(L, 0, 1.2, ...)` lights top edges. Use a colour brighter than the surface.

## 3. The pixel rules

These are the corrections that came up most. Check each one.

- **No noise textures.** Flat tones, and a checker or `k.bayer()` pattern where two tones meet. Low-frequency variation is fine. Grain is not.
- **Stepped outlines.** No CSS `border-radius` and no smooth borders on anything themed. Draw the outline in art pixels.
- **Lettering in the art's grid.** Use `k.ptext()`. Keep the real words in the page underneath, transparent, for layout and screen readers.
- **Themed surfaces are art too.** A card or frame around the control is drawn the same way, not left plain and not styled with CSS effects.
- **Whole-pixel motion.** Round positions of heads, hands and props. Sub-pixel motion makes the dither crawl.
- **Limbs have fixed lengths.** Use `k.reach()` for arms and legs, and put the work within reach. A limb that stretches reads as wrong before anything else does.
- **Light faces from in front.** Put the lamp on the far side of whatever the character is looking at.
- **Add the colours the light needs.** If a lit surface turns grey or green after the crush, the palette is missing that colour. Add it.
- **Ink outlines only on things you can press.** A status chip gets a plain frame. A button gets the outline and a hard shadow, and sits down on its shadow when pressed.
- **A creature is a silhouette first.** Get the outline reading at full size in flat black before adding anything inside it. For anything that moves in a cycle (wings, legs), draw three or four fixed poses and step between them. Do not let a limb pass behind the body, where it vanishes. Below about twenty pixels tall, a character is a shape, not a drawing.

## 4. Look before you say it is done

This is the step that matters most. A painter that runs without errors has told you nothing about how it looks.

1. Give the page a stopped clock. `k.run(frame, seconds)` does it: with `?film=1` in the address it exposes `window.__film.step()` and `.seek()`.
2. Capture the moments that matter, not evenly spaced ones: the start, mid-action, the turn, the end, and each state. Times are seconds from the start of the film. Use `--act "1.2:js"` to click or change something partway, and `"my-element >>> canvas"` to reach a canvas inside a custom element.

   ```sh
   node look.mjs "http://localhost:8000/starter.html?film=1" --times 0.2,0.5,0.9,1.6 --do "document.querySelector('input').checked = true"
   ```

3. Open the sheet and read it. For each frame ask: can I tell what this is with no label, is anything cut off or covering something it should not, does any limb or prop look wrong, did any colour go muddy.
4. Fix what you see and capture again. Expect several rounds. The first pass is never the one.

## 5. Wire it in

- **One file, one element.** Ship it as a single script that registers a custom element, with no dependencies and nothing added to the page's global names. That means pasting the kit's code into the component's own file inside one wrapper function; `kit.js` as a second file is for sketching. Several on one page must work: one painter and one animation loop for all of them.

  ```js
  (() => {
    // ...the kit and your painter, shared by every instance...
    const LIVE = new Set();
    class MyControl extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open', delegatesFocus: true }).innerHTML = '<button type="button"><canvas aria-hidden="true"></canvas><span>Label</span></button>'; }
      connectedCallback() { LIVE.add(this); }
      disconnectedCallback() { LIVE.delete(this); }
      advance(dt) { /* update this instance's state from its inputs, paint, and blit to its own canvas */ }
    }
    customElements.define('my-control', MyControl);
    let last = performance.now();
    requestAnimationFrame(function loop(now) { for (const el of LIVE) el.advance(Math.min(0.05, (now - last) / 1000)); last = now; requestAnimationFrame(loop); });
  })();
  ```
- **Attributes for what it says, an event for what it did.** The value or state comes in as an attribute or a method. Finishing fires one event, once.
- **A real control inside.** A `<button>`, an `<input>`, or a `role="status"` element carries focus, keys and announcements. Keyboard focus must be visible in the art.
- **Do not edit the painter to restyle someone else's component.** Change its attributes, or say what needs to look different.

## 6. Check it

Use it the way a person would, in a real browser, and report each of these separately.

- **Pointer:** a real press, hold and release, not a call into the code. In headless Chrome that means sending mouse events through the DevTools protocol (`Input.dispatchMouseEvent`), the same connection `look.mjs` opens.
- **Keyboard:** Tab to it, then the keys that should work it.
- **Two widths:** a desktop width and about 390 pixels.
- **More than one on a page,** if it is an element.
- **Speed:** frames per second while it is busiest.

## 7. Say what is true

Report in three parts, and keep them apart.

- **What it does now.**
- **What you checked, and how.** "Stepped through frame by frame in headless Chrome" is not "watched it at real speed". Say which.
- **What is still weak.** Name the frames that do not read. If a state only works with its label, say so.

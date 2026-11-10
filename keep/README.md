# Keep

A password field where strength is a castle. Every keystroke drops building pieces into a pixel-art scene. When you stop typing, a raccoon tests what you built.

One of four in this repo. Same idea in each (interaction changes a pixel world), different control: this one is a text field, and the scene is assembled piece by piece instead of scrubbed.

## Run it

```sh
python3 -m http.server 8000     # from the repo folder
# open http://localhost:8000/keep/
```

Two files, `index.html` and `app.js`. Vanilla JS and Canvas2D, no dependencies, no network requests, no sound. Nothing you type is stored or sent anywhere.

Click the card and type. The eye button shows or hides the characters. Paste, select-all and delete work as usual.

## What happens

The score lays down 100 pieces in order. Each character that makes the password harder to guess adds a handful; deleting knocks them off again, and so does finishing a word that turns out to be `password`.

| stage | what gets built | what the raccoon does |
|---|---|---|
| wide open | a few stakes | walks in and takes the chest |
| rope fence | stakes, rope and a sign | hops the rope and takes the chest |
| palisade | a wall of logs with a gate | brings a ladder and takes the chest |
| wall + moat | stone blocks, battlements, two pits of water | jumps, falls in, paddles out, goes home wet |
| castle | keep, towers, roofs, flags, a knight | gets an arrow at his feet and leaves |
| dragon | a dragon lands on the keep | gets set on fire and hides in his bush |

He waits about a second after your last keystroke. Type while he's on his way and he bolts.

A known password collapses the build no matter how long it is. Typing `hunter2` raises half a palisade, and the final `2` knocks it all down.

## How it scores a password

`strength()` estimates how many guesses a password would take, trying things in the order an attacker would, and the castle is built from that number. Length on its own buys very little.

| it looks for | example | what it is worth |
|---|---|---|
| the usual passwords | `password`, `hunter2`, `iloveyou` | almost nothing, even with a capital and a `1!` on the end |
| letters swapped for symbols | `P@ssw0rd` | read as the word it is, times a little |
| pronounceable words | `elephant` | far fewer guesses than eight random letters |
| keyboard runs and sequences | `qwertyuiop`, `abcdef`, `98765` | a few hundred guesses however long they are |
| the same thing repeated | `aaaaaaaa`, `justinjustinjustin` | the first one, times the number of repeats |
| years | `2024` | about a hundred guesses |
| everything else | `xK9#mQ` | one character at a time |

It then takes the cheapest way of covering the whole password with those. A thousand guesses is a rope fence, a million a palisade, ten billion a castle, and the dragon wants ten trillion.

| password | guesses | stage |
|---|---|---|
| `aaaaaaaaaaaaaaaaaaaa` | about 100 | wide open |
| `Password1!` | about 1,000 | rope fence |
| `summer2024summer2024` | about 100,000 | rope fence |
| `Tr0ub4dor&3` | about 200 million | wall and moat |
| `xK9#mQ2$vL` | about 6 trillion | castle |
| `correct horse battery staple` | more than 10^18 | dragon |

It is a small hand-written estimate with a word list of about ninety entries, so an uncommon real word is treated as merely pronounceable. It is good enough to drive a castle and not good enough to protect anything. On a real sign-up form, use a maintained estimator such as zxcvbn and keep the castle.

## How it's built

- **The real controls are still there.** A normal `<input type="password">` and `<button>` sit invisibly over the drawn field, so keyboards, paste, mobile and screen readers work the usual way. The stage name and verdict are mirrored into a live region.
- **Pieces, not frames.** The castle is a list of 100 pieces with positions and layers. The score picks how many are placed; each one drops in, lands with dust, and nudges the card.
- **The raccoon is scripted with generators.** Each raid is a short `function*` of walks, waits and tweens, so the five outcomes read top to bottom.
- **Feel.** The whole card sinks on each keystroke, characters pop in and fall out, and finishing a stage bumps the card and the meter.

## The clip

`keep-x.mp4` is 17.8 s, 1080×1080, 60 fps, silent. It uses the capture script in `film/`:

```sh
URL='http://localhost:8000/keep/?film=1' OUT=keep/keep-x.mp4 node film/render.mjs
```

A second take types `correct horse battery staple` (it reaches the dragon): add `&take=chbs` to the URL and set `OUT=keep/keep-chbs-x.mp4`. That clip is 14.4 s.

`?demo=1` plays the same take live and `&loop=1` repeats it. `?pw=Sunny!day42` starts with a password already typed, which is handy for checking a stage.

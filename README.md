# Pixel worlds

Ordinary controls with a small living pixel-art scene inside them. The control's value drives the scene: hold a delete button and a dragon breathes fire across it, and an agent's status line is a wizard doing whatever the agent is doing.

Everything is painted in code. There are no image files, no dependencies and no network requests.

## The four

| | control | what happens |
|---|---|---|
| [Keep](keep/) | password field | Each keystroke builds a castle. The stronger the password, the more of it there is. |
| [Round](round/) | loading bar | Seven regulars along a tavern bar empty their cups in turn as the task loads. |
| [Hoard](hoard/) | hold-to-delete button | A dragon asleep in the button. Hold it and the fire is the fill. |
| [Sage](sage/) | agent thinking states | A wizard at his desk: thinking, searching, reading, running, writing, waiting for you, done, failed. |

## Try them

Live: https://pixel-worlds.vercel.app

Or run it yourself:

```sh
python3 -m http.server 8000     # from this folder
# open http://localhost:8000/
```

That opens the gallery, where all four are live.

## Use one

Hoard and Sage are each a single file that defines an element. Copy the file into your project and:

```html
<script src="sage.js"></script>
<sage-status state="thinking"></sage-status>

<script src="hoard.js"></script>
<hoard-button heading="Delete this project" warning="This can't be undone."></hoard-button>
```

Their READMEs list the attributes, methods and events. Keep and Round are still whole pages, not elements.

In the gallery, "Copy a prompt for your agent" gives you an install prompt that points a coding agent at the real file and tells it to wire it in, not redraw it.

## Make your own

`skill/pixel-worlds/` is the workflow these were made by, written as a skill for a coding agent:

- `SKILL.md` is the workflow and the rules.
- `kit.js` is the painter: layers, light, the palette crush, a pixel font.
- `starter.html` is the smallest whole example, a lantern switch.
- `look.mjs` steps an animation to chosen moments and saves the frames side by side.

To use it, copy the `pixel-worlds` folder into your agent's skills folder (for Claude Code, `~/.claude/skills/`). The install prompt and the skill work together: the prompt puts one component in your app, and the skill is how to check it, change it or make another.

An agent with the skill gets a reasonable first pass. These took many rounds of looking at frames and fixing them, and yours will too.

## Clips

`film/render.mjs` records a page's `?film=1` take to a video, a frame at a time. It needs Node 22, Chrome and ffmpeg. The component READMEs give the commands.

## License

MIT. See [LICENSE](LICENSE).

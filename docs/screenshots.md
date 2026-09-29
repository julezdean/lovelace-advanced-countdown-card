# Screenshots

The images in `docs/images/` are produced from `demo/shot.html`, which renders
the cards of one scene at a fixed card width, on a frozen clock
(2026-09-29 18:25:43 UTC). A viewport screenshot is therefore the finished
image -- nothing is cropped by hand, and the same numbers appear on every run,
so the pictures can be regenerated after a change instead of quietly going
stale.

## Recipe

```
npm run build
./scripts/screenshots.sh
```

The script serves the repository root, and for each row of the table below
opens the stage in headless Chrome at the listed viewport (device scale 2) and
saves the screenshot.

| Image | Viewport | Query |
|---|---|---|
| `hero-light.png` | 1044 x 308 | `scene=hero&w=240` |
| `hero-dark.png` | 1044 x 308 | `scene=hero&w=240&dark=1` |
| `renderers.png` | 964 x 495 | `scene=renderers&w=220&cols=4` |
| `timer-states.png` | 964 x 296 | `scene=timer_states&w=220` |
| `layouts.png` | 408 x 377 | `scene=layouts&w=360&cols=1` |
| `colors.png` | 792 x 273 | `scene=colors&w=240` |
| `compact.png` | 792 x 229 | `scene=compact&w=240` |
| `errors.png` | 852 x 134 | `scene=errors&w=260` |
| `template.png` | 308 x 319 | `scene=template&w=260` |

The scenes themselves are in `demo/scenes.js`; the gallery at `demo/index.html`
runs the same list on a live clock.

## The numbers are measured, not constants

The viewport is the stage's body: `cols × w + (cols − 1) × 12` gap plus 48 px
of padding wide, and as tall as the tallest row. Card height follows content --
a status line, a subtitle, a larger ring or another card in a scene changes it.
After any visible change, open each scene and measure again:

```js
const b = document.body.getBoundingClientRect();
[Math.ceil(b.width), Math.ceil(b.height)];
```

then correct both the table above and `SHOTS` in `scripts/screenshots.sh`.
A screenshot that is cut off, or carries a band of empty page below the cards,
is a wrong screenshot.

## Keeping the pictures honest

The state shown in a screenshot is part of the screenshot. Each scene shows one
idea -- `timer_states` exists to show a paused, a finished and an idle timer
next to a running one, `errors` exists to show the three failure states. A new
demo goes into a new scene rather than displacing the case an existing image
was chosen to show.

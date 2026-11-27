# Film Viewfinder Simulator

What you see at the eyepiece of 61 film SLRs and rangefinders introduced 1954–2002, drawn at the same angular scale so finders can be compared side by side.

- **Size and coverage** come from each camera's magnification and frame coverage.
- **Focus aids** are simulated: ground-glass blur, split-image shift, microprism shimmer, rangefinder double image, parallax-shifting framelines.
- **Meter readouts** (needles, LEDs, LCDs) follow the aperture, shutter and light sliders in manual or auto.
- **Catalog table** is sortable and filterable, including by whether the finder shows shutter speed and aperture.

This is a prototype. Read "Accuracy" below before trusting a number.

## Run it locally

There is no build step and no dependency. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

The only external request is the Barlow typeface from Google Fonts. Without a connection the page falls back to system fonts.

## Files

| Path | What it holds |
| --- | --- |
| `index.html` | Page markup: stage, controls, catalog, notes |
| `css/style.css` | Page styles and colour tokens (top of file) |
| `js/scene.js` | The street scene, generated as four SVG depth layers (far, kerb, subject, foreground) |
| `js/data.js` | The camera catalog (`CAMERAS`) and the source list (`SOURCES`) |
| `js/render.js` | Exposure maths, the readout library (`D`), and the SLR and rangefinder renderers |
| `js/app.js` | State, controls, the compare stage, the catalog table |
| `tests/` | Checks on the catalog, the renderers and the page, run with Node (see "Tests") |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

The scripts are plain classic scripts loaded in that order and share globals. Settings are remembered per browser in `localStorage` under `vf-state`.

## How the drawing works

Finder coordinates are `1000 × tan(angle at the eye)`, with the origin at the centre of the frame. Every finder uses that one scale, which is what makes "True size" comparable.

- **SLR:** eyepiece focal length is `50 / magnification` (or `magRef / magnification`). The frame half-width is `18 mm × coverage` divided by that focal length. Blur per depth layer is the circle of confusion `f² · |1/s − 1/focus| / N`, applied as a Gaussian. Split-image and microprism offsets use the same defocus with an f/4.5 wedge base.
- **Rangefinder:** the scene is scaled by the finder magnification and never blurred. Frameline half-width is `18 / f × magnification × fcov`. The ghost in the patch is offset by `magnification × base × (1/s − 1/focus)`.

## Add or correct a camera

Edit `js/data.js`. Each entry is wrapped in `SLR({...})`, `RF({...})` (interchangeable-lens rangefinder) or `FX({...})` (fixed lens), which fill in defaults.

Common fields:

| Field | Meaning |
| --- | --- |
| `id`, `make`, `model`, `year`, `years` | Identity. `year` is used for sorting |
| `mag` | Finder magnification. For SLRs it is with a 50 mm lens unless `magRef` is set |
| `top` | Fastest shutter speed, as a denominator (`1000`, `4000`) |
| `auto` | Automation used when the Exposure control is on Auto: `'A'`, `'S'`, `'P'` or `null` |
| `shut`, `ap` | What the finder tells you about each setting: `'set'`, `'metered'`, `'both'` or `null` |
| `disp` | Readouts to draw, as `[kind, options]` pairs. Kinds are the keys of `D` in `render.js` |
| `est` | Fields that are estimates: `'mag'`, `'cov'`, `'layout'`. Shown with ≈ |
| `note` | The one-paragraph description |

SLR fields: `cov` (or `covH` and `covV`) as a linear fraction of the frame, `scr` (`sm` split + microprism, `split`, `micro`, `plain`, `fullmicro`, `af`), `bright` (0–1), `vig` (corner darkening), `ring`, `spot`, `rect12`, `af`.

Rangefinder fields: `win` (window half-size in finder units), `frames` (sets of focal lengths shown together), `fcov`, `base` (rangefinder base in metres), `patch` (half-size `w` and `h`, plus `rx` for rounded ends, `soft` for blurred edges, `diamond`, `tint`), `par` (`auto`, `marks`, `none`), `tint`, and for fixed-lens cameras `lens: {f, N}`.

To add a new kind of readout, add a function to `D` in `render.js`. It receives the frame half-size, the computed exposure state and the camera, and returns SVG markup.

After adding a camera, update the count and the years in the first line of this file and run the tests. Add what you checked to `SOURCES`.

## Tests

The tests need Node 20 or later and nothing else. They load the same scripts the page does, render every camera at a spread of control settings, and start the page against a stand-in DOM.

```sh
node --test tests/*.test.js
```

## Publish on GitHub Pages

1. Create a public repository named `camera-finder-view` and push this folder to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, and save.
4. After a minute or two the site is at `https://<username>.github.io/camera-finder-view/`.

All paths in `index.html` are relative, so the site works under that sub-path without changes.

## Accuracy

- Magnification and coverage for about a dozen cameras were checked against manuals and manufacturer pages (listed in `SOURCES` and shown on the page). The rest are from recalled manufacturer specifications and were not re-verified.
- Values marked ≈ are estimates.
- Readout layouts are schematic: what each finder shows and roughly where, not traced lettering or exact placement.
- The Canon T90, Minolta Maxxum 7000 and Contax G2 share one generic LCD strip (`D.lcdbar`). The EOS and Nikon autofocus bodies have their own (`D.eos`, `D.nikon`).
- Rangefinder window sizes, patch shapes, tints and screen brightness are approximations.
- Rangefinder framelines are all drawn as corner brackets. Many real finders, the Bessas among them, draw broken side lines.
- The Bessa R and R2 manuals name five meter states without figures, so the points where the LEDs switch are a guess.
- Eye relief, dioptre, flare and dust are not modelled.

## Not included yet

Medium format and waist-level finders, the Nikon SP, Konica Autoreflex, Fujica ST801 and Topcon.

## Licence

No licence has been chosen. Add a `LICENSE` file if you want others to reuse the code.

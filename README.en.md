<p><img src="brand/steam-icon-128.png" width="64" height="64" alt="ZHENGQI"></p>

# FlatPack3D

[中文](README.md) | English

> **v0.1.1 preview. Feedback welcome:** [open an issue](https://github.com/zzzhengqi/FlatPack3D/issues).

## Get started in three steps

1. **Create an empty folder** with an `inputs/` folder inside, and put the manual PDFs in it (optional: product images; product page links in `inputs/links.txt`).
2. **Copy the message below and send it to your agent** (Claude Code, Codex, …), opened in that folder:

   ```text
   Please turn the product assembly manual in this folder into an interactive 3D manual.
   - The materials are in the inputs/ folder (manual PDFs, possibly product images and product page links).
   - The tools and workflow are here: https://github.com/zzzhengqi/FlatPack3D/blob/v0.1.1/AGENTS.md
     Read it first and follow its workflow strictly.
     If you can't open web pages, use git to download version v0.1.1 of https://github.com/zzzhengqi/FlatPack3D, then read the AGENTS.md inside.
   - Stop and ask me before installing any software, and wherever the workflow asks for my confirmation.
   - When you're done, tell me how to open and view it.
   ```

3. **The agent stops at two checkpoints to ask you** (part and hardware counts; the manual-vs-3D comparison sheets). Just answer truthfully.

The agent downloads the tools into a `FlatPack3D/` subfolder of that folder and asks you before installing anything that is missing (Node.js, Python, Chrome/Edge). Your manuals and images stay in that folder and are never committed to any repository.

## What it is

Turn paper / PDF furniture assembly instructions into an interactive 3D step-by-step assembly demo: step animations, hardware counts, side-by-side manual pages, zoom circles (line art, like the call-outs in a manual), line-art view, Chinese and English UI.

The repository has two parts:

1. **Engine and tools**: a single-file Three.js page `index.html`, plus build, validation, framing-check and comparison scripts (`scripts/`, entry point `scripts/flatpack.js`). The engine knows nothing about any specific piece of furniture.
2. **The `manual-to-3d` skill**: the whole "manual → 3D manual" workflow written as instructions an agent can follow (`skills/manual-to-3d/`). The skill contains instructions only; every tool it uses lives in this repository. When the current folder is not this repository, the agent first downloads v0.1.1 into a `FlatPack3D/` subfolder.

Example product: IKEA KALLAX shelving unit (5×5, two wall-anchoring options) + insert with door (hinges left / right) + insert with 2 drawers + full set + against-the-wall Room view. See `skills/manual-to-3d/examples/kallax/`.

> **Manuals and product images are not in this repository.** Manual PDFs, manual page images and product images are copyrighted by the manufacturer. Put your own manual PDFs and product images in `inputs/` (listed in `.gitignore`, never committed). Without page images, the manual panel shows page numbers and a link to the official PDF and everything else works; once you render the pages locally, the images appear automatically.

> **Safety (KALLAX)**: the manual's first warning (p2) is that furniture can tip over and cause serious or fatal crush injuries, so the unit must be fixed to the wall with the included anchoring hardware. Wall screws and plugs are not included; choose them for your wall material. This demo is illustrative only; follow the official instructions when assembling.

## Install the skill for Claude Code (optional)

Not needed for the three steps above. To say "Use manual-to-3d to turn the manual in inputs/ into a 3D manual" in any folder, copy the skill into `.claude/skills/` in your home directory. From the cloned repository folder:

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse -Force skills\manual-to-3d "$HOME\.claude\skills\"
```

```bash
# macOS / Linux
mkdir -p ~/.claude/skills && cp -R skills/manual-to-3d ~/.claude/skills/
```

If you open Claude Code inside the repository folder, it works without copying (the repository ships `.claude/skills/manual-to-3d/`). Other agents (Codex, Cursor, Gemini CLI, …) need no install: have them read `AGENTS.md` at the repository root.

## Developers: clone the whole repository

Requirements: [Node.js](https://nodejs.org/) 22 or later; Python 3 with `pip install pymupdf opencv-python pillow numpy` (rendering manual pages, comparison sheets); Chrome or Edge installed locally (framing screenshots).

```bash
git clone --depth 1 --branch v0.1.1 https://github.com/zzzhengqi/FlatPack3D.git
cd FlatPack3D
node scripts/flatpack.js doctor
```

Without git: download the [v0.1.1 zip](https://github.com/zzzhengqi/FlatPack3D/archive/refs/tags/v0.1.1.zip), extract it and enter `FlatPack3D-0.1.1/`. To contribute, clone the `main` branch (drop `--depth 1 --branch v0.1.1`).

## Try it

- **Windows**: double-click `start.bat` (starts a local server on port 8137, or another free port, and opens the browser).
- **Any OS**: `node scripts/flatpack.js serve 8137 --open`.

The page loads JSON with `fetch`, so opening `index.html` directly from disk does not work. Chinese page `http://localhost:8137/`, English page `http://localhost:8137/en/`.

| URL parameter | Example | Meaning |
|---|---|---|
| `product` | `?product=kallax` | Product; defaults to the default product in `data/products.json` |
| `piece` | `?piece=door` | Piece: KALLAX has `body`, `door`, `drawer`, `set`, `room` |
| `variant` | `?piece=door&variant=right` | Route (KALLAX door `left` / `right`; body and Room `a` / `b`) |
| `step` | `?piece=body&step=12` | Jump to manual step 12; `0` is the parts check |
| `lang` | `?lang=en` | UI language; or open `en/` directly |

Keyboard shortcuts are under "Shortcuts" at the top right. Dragging or zooming pauses auto-framing (a click does not); press `R` or "Overview" to resume.

## Commands

Run from the repository root:

```bash
node scripts/flatpack.js doctor                       # check Node 22+, Python packages, Chrome/Edge
node scripts/flatpack.js new my-shelf --title=Shelf   # new product skeleton data/my-shelf/, local folder inputs/my-shelf/
node scripts/flatpack.js render my-shelf              # render the PDFs in inputs/my-shelf/
node scripts/flatpack.js build my-shelf               # run the build scripts, generate assembly data
node scripts/flatpack.js validate --product=my-shelf  # validate against the analysis report + framing check
node scripts/flatpack.js review my-shelf              # manual ↔ 3D comparison sheets
```

A new product only needs data and build scripts under `data/<product>/`; the engine, validator and framing check stay unchanged.

## Layout

```
index.html, en/index.html   engine (en/ generated by scripts/build-meta.js)
vendor/three@0.160.0/       three.js r160 (MIT, see LICENSE in that folder), works offline
data/products.json          product index (generated by scripts/build-index.js)
data/ui.zh.json, ui.en.json engine UI strings
data/<product>/             product data: manifest, analysis report, dimension sources, build scripts, assembly data, copy, translations, share images
scripts/                    tools: entry point flatpack.js, build, validate, framing check, manual page rendering, share images, comparison sheets and videos (review/)
skills/manual-to-3d/        the skill: SKILL.md, references/, examples/
.claude/skills/manual-to-3d/  copy of the skill (picked up when Claude Code runs in the repository; run flatpack.js sync-skill after editing the skill)
brand/                      ZHENGQI logo (not covered by the MIT license, see LICENSE)
inputs/ renders/ exports/   local only, never committed: your manuals and product images, rendered pages, comparison sheets and videos
```

## About "internal IDs"

Manuals number the hardware but usually not the panels. The "internal ID" shown when you click a part (e.g. `divider-r3-2`) is the `id` in this project's data, not a manufacturer part number.

## License

The code is released under the [MIT License](LICENSE). The ZHENGQI logo in `brand/` is not covered by the MIT License and may not be used without permission. `vendor/three@0.160.0/` is three.js under its own MIT License.

## Disclaimer

This project is not affiliated with or endorsed by IKEA. KALLAX and IKEA are trademarks of Inter IKEA Systems B.V. The example data was compiled from the publicly available assembly instructions; download the original manuals from the official links (see `data/kallax/manifest.json`).

by ZHENGQI (蒸汽)

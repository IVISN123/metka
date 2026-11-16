# Метка

**Метка — кастомный улучшенный редактор этикеток для Niimbot.**  
**Metka — a custom enhanced Niimbot label editor.**

Design a label in the browser the way you would in Figma: select a block, drag it, resize the geometry, edit text on the canvas, and restack layers. Then preview the 1-bit raster and send it to a Niimbot thermal printer over Web Bluetooth or Web Serial. Nothing is uploaded. There is no account and no backend.

Метка is an independent project. It is not affiliated with or endorsed by NIIMBOT.

## What the editor does

- Bounding box with eight handles and a rotation zone. Shift keeps proportions, Alt resizes from the center, arrow keys nudge (Shift moves 1 mm).
- Smart guides snap to the label edges, the center, and other objects, with distance labels in millimetres.
- Marquee and Shift-click multi-select, group and ungroup, duplicate with Ctrl/⌘+D or Alt-drag, lock and hide.
- Text like a layout tool: double-click to edit on the canvas, auto-width / auto-height / fixed size, alignment, line height, letter spacing. Resizing the box does not scale the glyphs. Press K when you do want the font size to follow the corner.
- Shapes keep a constant stroke width and corner radius in millimetres. Stretching changes width and height, not a scale transform. Stroke can sit center, inside, or outside.
- A compact design panel: X, Y, W, H and rotation in millimetres, with labels you can drag to scrub the value. Fill and stroke sit in their own sections.
- A layers panel with drag-and-drop reorder (z-order only), a drop indicator, nested groups, rename on double-click, and visibility and lock toggles that stay in sync with the canvas.
- Light, dim, and dark themes. Panel, menu, and layer motion respects `prefers-reduced-motion`.
- Niimbot sizes, photos, icons, barcodes, QR codes, dates, and series data. QR and barcodes are vector objects: resizing calls `setBox` so the modules redraw into the new box.

## Credits

Printing uses [`@mmote/niimbluelib`](https://github.com/MultiMote/niimbluelib) 0.49.0, the library behind [NiimBlue](https://niim.blue/). **It has not been tested on a physical printer in this environment.** Chrome or Edge on desktop or Android, served over HTTPS (or `localhost`), is required for a real print. Safari on iPhone and iPad cannot print from this page.

Icons in the interface and most label symbols are from [Lucide](https://lucide.dev/) (ISC), bundled in the app. A few label marks are drawn for Метка. The UI fonts and the label fonts (Roboto, Open Sans, PT Sans, PT Serif, Montserrat, Inter, Rubik, Oswald, Roboto Condensed, Nunito, Manrope, IBM Plex Sans, IBM Plex Mono, Golos Text, Unbounded, Exo 2, Noto Sans, Noto Serif, Fira Sans, JetBrains Mono, OpenGOST type A, OpenGOST type B) are under the SIL Open Font License 1.1. See `src/fonts/OFL.txt` and `src/fonts/OFL-OpenGost.txt`. They are stored in this repository and are not loaded from a network at runtime.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123/metka/. The dev server is only for working on the app. People using Метка do not install anything: they open the hosted page.

```bash
npm test
npm run build
npm run preview
```

## Deploy

GitHub Pages for this repo is [https://ivisn123.github.io/metka/](https://ivisn123.github.io/metka/). Vite’s `base` is `/metka/`, so scripts, CSS, and the favicon resolve under that path.

`.github/workflows/deploy.yml` runs `npm ci && npm run build` on every push to `main`, uploads `dist/` with `actions/upload-pages-artifact`, and publishes it with `actions/deploy-pages`.

In the GitHub repo, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The first push does not turn that on by itself. After it is set, the workflow publishes the site.

`npm run build` also writes `dist/` for any other static host. That build is rooted at `/metka/`. A host that serves the files at the domain root needs `base` changed first. The host must use **HTTPS**. Web Bluetooth and Web Serial are disabled on plain `http://` except for `localhost`. Opening `dist/index.html` as a `file://` URL will not work.

## PIN gate

The public site can ask for a 4-digit PIN before the editor opens. This is a deterrent for casual visitors, not real protection. The page is a static bundle anyone can download: the salted SHA-256 sits in the JavaScript, and four digits can be checked offline. It does not hide the files or stop a determined person. Real protection would be something like Cloudflare Access on a custom domain.

Local `npm run dev`, `npm test`, and any build where the variables are empty leave the gate off. Until both secrets below exist, the deployed site stays open.

### Set the secrets

The PIN is not stored in this repo. The script prints a salt and a hash, and does not write a file. It runs on Node 22, the same version as the deploy workflow:

```bash
npm run pin-hash -- 1234
```

In the GitHub repo, open **Settings → Secrets and variables → Actions → New repository secret** and create both:

| Secret | Value |
| --- | --- |
| `VITE_METKA_PIN_SALT` | the salt the script printed (32 hex characters) |
| `VITE_METKA_PIN_HASH` | the hash the script printed (64 hex characters) |

`.github/workflows/deploy.yml` passes those into `npm run build`. Redeploy by pushing to `main`, or with **Actions → Deploy GitHub Pages → Run workflow**. Copy both values exactly. A mistyped hash locks the site until you replace the secrets and redeploy. An empty or missing secret leaves it open.

To try the gate on your machine, put the same two lines in `.env.local` (gitignored) and restart `npm run dev`.

### Change the PIN

Run `npm run pin-hash` again with the new four digits, replace both secrets, and redeploy. Browsers that already unlocked store the previous hash in `localStorage`, so a new hash asks for the PIN again. **Файл → Заблокировать** locks this device without changing the PIN. The unlock is remembered only on that device.

## Templates and designs

Everything is stored in this browser:

- **Autosave** restores the last label when you reopen the page.
- **Save** keeps a named design in IndexedDB.
- **Save as template** keeps a reusable template with a thumbnail.
- The **Templates** gallery lists built-in starters and your own templates. You can open, rename, duplicate, and delete them. Built-ins can be opened or duplicated; they are not stored until you duplicate or save.
- **Export all** downloads `metka-templates-YYYY-MM-DD.json`. **Import** on another browser or phone adds those templates to its IndexedDB. A single design JSON (`kind: "metka-design"`) can be imported too.
- **File → Export JSON / PNG / 1-bit PNG** saves the current label. Clearing site data deletes the local library; export a file first if you want to keep it.

The file is plain JSON. It contains your label, including any photos you placed on it.

## What the editor does

- Niimbot sizes (12×40, 14×30, 15×30, 30×15, 40×30, 50×30, and others), custom millimetres, and DPI from the printer model (D110, D11, B1, B21, B18, …).
- Move, resize, rotate, snap, reorder, undo, and zoom text, photos, icons, shapes, Code 128 / EAN-13 / other barcodes, QR codes, and dates.
- Photos can be dropped, pasted, or uploaded. Brightness, contrast, invert, and dithering (threshold, Floyd–Steinberg, Atkinson) feed the live 1-bit preview.
- A series (`01` … `N`) or a CSV can fill the selected object or `{{column}}` placeholders.
- Print options: density, copies, label type, print direction, alignment on the printhead, and the niimbluelib print task. Battery and paper come from the printer heartbeat when the model reports them.

## Print path

Connection uses `instantiateClient('bluetooth' | 'serial')`. A page is rasterized to pure black and white, padded to the model printhead when the label is narrower, then:

```ts
ImageEncoder.encodeCanvas(canvas, PageColorType.SingleColor, direction)
const task = client.protocol.newPrintTask(taskName, {
  totalPages, density, labelType, pageColor: PageColorType.SingleColor,
  statusPollIntervalMs: 100, statusTimeoutMs: 8000,
})
await task.printInit()
await task.printPage(encoded, copies)
await task.waitForPageFinished()
await task.waitForFinished()
await task.printEnd()
```

Heartbeat polling is paused while those packets are sent, then resumed. If the connected printer reports a task, that task is used unless you pick one yourself. This sequence matches the library’s current example and was not run against hardware here.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 43123 |
| `npm run build` | Typecheck and static build |
| `npm run preview` | Serve `dist/` |
| `npm test` | Unit tests (geometry, CSV, dither, template files, encoder, PIN hash) |
| `npm run pin-hash -- 1234` | Print a salt and SHA-256 for the PIN-gate secrets |

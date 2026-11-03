# Метка

A static label designer and printer for Niimbot thermal printers. It runs entirely in the browser: design a label, preview the 1-bit raster, and send it over Web Bluetooth or Web Serial. Nothing is uploaded. There is no account and no backend.

The print path uses [`@mmote/niimbluelib`](https://github.com/MultiMote/niimbluelib) 0.49.0, the library behind [NiimBlue](https://niim.blue/). **It has not been tested on a physical printer in this environment.** Chrome or Edge on desktop or Android, served over HTTPS (or `localhost`), is required for a real print. Safari on iPhone and iPad cannot print from this page.

Метка is an independent project. It is not affiliated with or endorsed by NIIMBOT.

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
| `npm test` | Unit tests (geometry, CSV, dither, template files, encoder) |

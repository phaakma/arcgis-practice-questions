# ArcGIS practice questions

> **DISCLAIMER: These are NOT Esri exam questions and this site is NOT official.**
> It is not produced, reviewed or endorsed by Esri. Questions were written independently for
> study practice and MIGHT be out of date or wrong. ALWAYS refer back to official Esri
> documentation and the exam's official information guide.

A small static web app for practising multiple-choice questions, one question at a time, with
explanations and links to the source documentation.

Live site: https://phaakma.github.io/arcgis-practice-questions/

## Run locally

The app loads JSON with `fetch`, so it must be served over HTTP (opening `index.html` from disk
won't work). On Windows, run `run-server.bat` (requires Node.js), or:

```
npx http-server . -p 8080 -c-1
```

## Structure

- `index.html`, `css/`, `js/app.js` — the app (vanilla JS, no build step).
- `data/manifest.json` — lists the exams.
- `data/exams/<id>.json` — one file per exam, each holding bundles of 20 questions.
  In the data, the correct answer is always first (`"correct": 0`); the app shuffles answers.

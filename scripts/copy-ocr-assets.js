// Copies the in-browser label reader (tesseract.js worker, WASM core and
// English model) into public/ocr so the web build serves it from its own
// origin: no CDN at runtime, and it works under cross-origin isolation.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'ocr');
const mod = (p) => path.join(root, 'node_modules', p);

const files = [
  [mod('tesseract.js/dist/tesseract.min.js'), 'tesseract.min.js'],
  [mod('tesseract.js/dist/worker.min.js'), 'worker.min.js'],
  [mod('tesseract.js-core/tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [mod('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [mod('tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [mod('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'), 'eng.traineddata.gz'],
];

fs.mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(from, path.join(out, to));
}
console.log(`Copied ${files.length} OCR assets to public/ocr`);

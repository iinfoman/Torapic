import type { Worker as OcrWorker, PSM } from 'tesseract.js';

import { ITEMS } from '@/data/seed';

import type { VisionClassifier } from './classifier';
import { matchLabel, type LabelLine } from './label-matcher';

/** Assets copied into public/ocr by scripts/copy-ocr-assets.js. */
const BASE = '/ocr';
/** Tesseract's own per-line confidence (0–100); below this a line is mostly noise. */
const MIN_LINE_CONFIDENCE = 45;

const TARGETS = ITEMS.map((i) => ({ itemId: i.id, name: i.name, aliases: i.aliases }));

type TesseractGlobal = { createWorker: typeof import('tesseract.js').createWorker };

let worker: Promise<OcrWorker> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Loads the reader once; the language model is cached in IndexedDB for later visits. */
function getWorker(): Promise<OcrWorker> {
  worker ??= (async () => {
    await loadScript(`${BASE}/tesseract.min.js`);
    const { createWorker } = (window as unknown as { Tesseract: TesseractGlobal }).Tesseract;
    const ocr = await createWorker('eng', 1 /* LSTM only */, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: BASE,
      langPath: BASE,
      gzip: true,
    });
    // Sparse-text mode: packaging is scattered text, and the default page mode
    // drops the very large headline (the product name) entirely.
    await ocr.setParameters({ tessedit_pageseg_mode: '11' as PSM.SPARSE_TEXT });
    return ocr;
  })().catch((error) => {
    worker = null; // allow a retry on the next scan
    throw error;
  });
  return worker;
}

/** In-browser label reading (tesseract.js), the web counterpart of ML Kit on native. */
export const ocrClassifier: VisionClassifier | null = {
  async prepare() {
    await getWorker();
  },
  async classify(input) {
    if (!('uri' in input)) return [];
    const ocr = await getWorker();
    const { data } = await ocr.recognize(input.uri, {}, { blocks: true });
    const lines: LabelLine[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines
          .filter((line) => line.confidence >= MIN_LINE_CONFIDENCE)
          .map((line) => ({ text: line.text, height: line.bbox.y1 - line.bbox.y0 }))
      )
    );
    return matchLabel(lines, TARGETS);
  },
};

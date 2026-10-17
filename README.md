# Torapic

Snap or search any food, herb, spice or supplement and get its single strongest bio-active benefit, the science in one sentence, the partners that amplify it, and same-class alternatives. Works fully offline.

Expo SDK 58 · React Native 0.88 · Expo Router · expo-sqlite (FTS5) · Reanimated 4 · Zustand

## Run it

```bash
npm install
npx expo start          # press i / a for a simulator, or w for web
npm test                # schema, seed integrity, search ranking (node:sqlite)
npm run typecheck
npx expo lint
```

Haptics, blur and native tabs need a device or simulator; the web build is a quick preview.

## Architecture

```
src/
  app/                    Expo Router screens
    (tabs)/index.tsx      Discover: smart search + featured carousels
    (tabs)/scan.tsx       Scan HUD (demo classifier for now)
    (tabs)/stack.tsx      My Daily Stack
    item/[id].tsx         Hero Insight Card screen
  components/             Glass, badges, HeroInsightCard, ScanHud, ...
  data/seed.ts            Bundled offline content (items, benefits, synergies)
  db/schema.ts            Tables, FTS5 index, versioned seeding
  db/repository.ts        Search, insight, alternatives, stack queries
  vision/classifier.ts    Camera → item id contract
  theme/tokens.ts         Palette, category colors, type, spacing, glow
tests/                    Runs the real SQL against node:sqlite
```

**Offline-first.** All content ships inside the app and is loaded into a local SQLite database on first launch. Nothing on the core path needs a network.

**One contract between AI and content.** The vision model only returns `{ itemId, confidence }`. Everything the user sees comes from the local database, so content can be edited without retraining and the model can be swapped without touching content. Scan and search end on the same screen.

**Content versioning.** Bump `CONTENT_VERSION` in `src/data/seed.ts` after editing content. Installed apps rebuild the content tables on next launch; the user's stack is preserved.

**Search.** Queries are tokenized and matched two ways. FTS5 with bm25 column weights handles names, aliases and wording. A benefit matcher maps goals and symptoms ("burn belly fat", "joint pain") to benefits and ranks items by benefit strength × evidence grade. Where FTS5 is unavailable (default web build), a name-only LIKE fallback takes over; tests cover both paths.

## Content rules

- Every claim carries an evidence grade: **A** human RCTs or meta-analyses, **B** small or observational human data, **C** lab or animal data.
- Wording is "supports", "linked to", "in trials". Never "cures". A test enforces this.
- Every item lists the interactions and contraindications a pharmacist would flag.
- The insight screen carries a not-medical-advice line.

## Roadmap

1. ~~Foundation: tokens, schema, seed content, offline search~~
2. ~~Hero Insight Card, Power Stack, alternatives, daily stack~~
3. Camera HUD: `react-native-vision-camera` frame processors driving `ScanHud`
4. Edge AI: fine-tuned, quantized classifier via `react-native-fast-tflite` (CoreML delegate on iOS) + on-device label OCR; replaces `demoClassifier`
5. Cloud: background content sync, stockist pricing, deep conversational queries

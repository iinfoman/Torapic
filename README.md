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

## Deploy the web app (fastest way onto a phone)

1. Netlify → **Add new project** → **Import an existing project** → GitHub → this repo. `netlify.toml` already sets the build command, publish folder and the headers the app needs.
2. **Project configuration → Environment variables**: add `ANTHROPIC_API_KEY` (scope: Functions). Optional: `TORAPIC_VISION_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is ~40× cheaper per scan).
3. Deploy, open the URL on your phone, allow the camera.

### How scanning works

| Step | Where | Cost | Needs internet |
|---|---|---|---|
| 1. Read the label (OCR) and match the library | On the phone | Free | No |
| 2. Only if step 1 isn't confident: vision AI looks at the photo | `netlify/functions/identify.mts` → Claude | Roughly $0.02 per cloud scan on Opus 5.5, ~$0.0005 on Haiku 5.5 (estimates) | Yes |

Packaged products are usually identified in step 1 and never reach the cloud. Loose produce, herbs and unlabeled items go to step 2. Offline, step 2 is skipped and the on-device result stands. If the AI recognizes something the library doesn't have, the app says what it saw and offers a search. The API key lives only in the Netlify function, never in the app.

## Run it on your phone (real label scanning)

Label reading uses Google ML Kit on-device, which is native code Expo Go doesn't include. Install a development build once; after that, code changes reload instantly like Expo Go.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # or ios
# install the build from the link EAS prints, then:
npx expo start
```

iOS internal builds need your device registered first: `npx eas-cli@latest device:create`. In Expo Go and on web, scanning falls back to a clearly labelled demo that picks random items.

## Architecture

```
src/
  app/                    Expo Router screens
    (tabs)/index.tsx      Discover: smart search + featured carousels
    (tabs)/scan.tsx       Live camera + scan HUD
    (tabs)/stack.tsx      My Daily Stack
    item/[id].tsx         Hero Insight Card screen
  components/             Glass, badges, HeroInsightCard, ScanHud, ...
  data/seed.ts            Bundled offline content (items, benefits, synergies)
  db/schema.ts            Tables, FTS5 index, versioned seeding
  db/repository.ts        Search, insight, alternatives, stack queries
  vision/classifier.ts    Camera → item id contract (demo classifier for now)
  vision/identify.ts      Capture → classify → offline lookup → lock or miss
  vision/ocr-classifier.ts On-device ML Kit label reading (dev/store builds)
  vision/label-matcher.ts Finds library items in label text, weighted by text size
  vision/cloud-classifier.ts Resizes the photo, calls the identify function
  vision/hybrid.ts        On-device first, cloud only when needed and reachable
server/identify.ts        Vision prompt + schema locked to library ids (tested)
netlify/functions/        identify.mts: the serverless endpoint holding the API key
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
3. ~~Camera HUD: live `expo-camera` feed, permission flow, torch, freeze-frame lock-on~~
4. Edge AI
   - ~~On-device label reading (ML Kit text recognition) for supplement bottles and packaged spices~~
   - ~~Loose produce, herbs and anything unlabeled: cloud vision AI (Claude) behind a serverless function, used only when on-device reading isn't confident~~
   - Fully offline produce recognition: train a small on-device image model; cloud-identified scans (with user consent) are the natural training data
5. Cloud: background content sync, stockist pricing, deep conversational queries

For native builds, set `EXPO_PUBLIC_API_URL` (e.g. `https://your-site.netlify.app`) so the app can reach the identify function; without it, native scanning stays on-device only.

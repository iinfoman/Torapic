import type { Classification } from './classifier';

/** One line of recognized text and how tall it was in the photo. */
export type LabelLine = { text: string; height: number };

export type MatchTarget = { itemId: string; name: string; aliases: string[] };

/**
 * Aliases that are useful for search but too generic to identify a product
 * from its label ("Dietary fiber" sits on every nutrition panel).
 */
const GENERIC_TERMS = new Set(['fiber', 'pepper', 'citrus', 'vinegar', 'orange', 'glutathione', 'leafy greens']);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when a and b differ by at most one edit (OCR often swaps i/l, o/0). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function wordMatches(term: string, word: string): boolean {
  // Short words must match exactly; "nac" one edit from "nad" would be a false lock.
  return term.length >= 6 ? withinOneEdit(term, word) : term === word;
}

/** Does `phrase` appear as consecutive words in `words`? */
function containsPhrase(words: string[], phrase: string[]): boolean {
  outer: for (let start = 0; start + phrase.length <= words.length; start++) {
    for (let k = 0; k < phrase.length; k++) {
      if (!wordMatches(phrase[k], words[start + k])) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Finds library items named on a product label. A match in the biggest text
 * (the product name) is near-certain; one only in small print (ingredients,
 * nutrition panel) stays below the lock-on threshold.
 */
export function matchLabel(lines: LabelLine[], targets: MatchTarget[]): Classification[] {
  const usable = lines.filter((l) => l.text.trim() && l.height > 0);
  if (usable.length === 0) return [];
  const tallest = Math.max(...usable.map((l) => l.height));
  const tokenized = usable.map((l) => ({ words: normalize(l.text), prominence: l.height / tallest }));

  const results: Classification[] = [];
  for (const target of targets) {
    const terms = [
      { phrase: normalize(target.name), isName: true },
      ...target.aliases
        .filter((a) => !GENERIC_TERMS.has(a.toLowerCase()))
        .map((a) => ({ phrase: normalize(a), isName: false })),
    ].filter((t) => t.phrase.length > 0 && t.phrase.join('').length >= 2);

    let best = 0;
    for (const line of tokenized) {
      for (const term of terms) {
        if (!containsPhrase(line.words, term.phrase)) continue;
        // Specific multi-word names ("milk thistle") are stronger evidence than one short alias.
        const specificity = Math.min(1, 0.85 + 0.05 * term.phrase.length + (term.isName ? 0.05 : 0));
        best = Math.max(best, line.prominence * specificity);
      }
    }
    if (best > 0) results.push({ itemId: target.itemId, confidence: round(0.4 + 0.55 * best) });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

const round = (n: number) => Math.round(n * 100) / 100;

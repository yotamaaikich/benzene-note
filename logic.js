import { compounds, questions } from './data.js';

export function normalizeName(value) {
  return String(value).normalize('NFKC').toLowerCase()
    .replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s,，.。・\-‐‑–—−()（）\[\]「」]/g, '');
}
export function isCorrectName(compoundId, value) {
  const compound = compounds[compoundId];
  return Boolean(normalizeName(value)) && [compound.name, ...(compound.aliases || [])]
    .some(name => normalizeName(name) === normalizeName(value));
}
export function nextRevealStage(stage) { return Math.min(2, Math.max(0, Number(stage) || 0) + 1); }
export function questionIds(category = 'all') {
  return questions.filter(q => category === 'all' || q.category === category).map(q => q.id);
}
export function needsReview(record) { return Boolean(record && (record.helped || record.wrong || !record.correct)); }
export function shuffle(ids) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

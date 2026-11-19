import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { compounds, questions, categories } from '../data.js';
import { origins } from '../origins.js';
import { isCorrectName, normalizeName, nextRevealStage, questionIds, needsReview, shuffle } from '../logic.js';
import { moleculeSVG } from '../molecules.js';

test('the reference-derived question bank is complete and internally consistent', () => {
  assert.equal(questions.length, 49);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const q of questions) {
    assert.ok(compounds[q.from], q.id + ' reactant');
    assert.ok(compounds[q.to], q.id + ' product');
    assert.ok(categories.some(c => c.id === q.category));
    assert.ok(q.conditions.length > 0);
    assert.ok(q.explanation.length > 15);
    assert.ok(origins[q.to]?.length > 15, q.id + ' name explanation');
    assert.ok(moleculeSVG(q.to).includes('<svg'));
  }
});
test('skip reveals the structure first, the name second, and never advances the question', () => {
  const state = { index: 7, stage: 0 };
  state.stage = nextRevealStage(state.stage);
  assert.equal(state.stage, 1); assert.equal(state.index, 7);
  state.stage = nextRevealStage(state.stage);
  assert.equal(state.stage, 2); assert.equal(state.index, 7);
  assert.equal(nextRevealStage(state.stage), 2);
});
test('a structure can be rendered without leaking its name through accessible labels', () => {
  for (const id of Object.keys(compounds)) {
    const svg = moleculeSVG(id, 'お手本の構造式');
    assert.ok(!svg.includes(compounds[id].name), id);
    assert.ok(svg.includes('aria-label="お手本の構造式"'));
    assert.ok(!/undefined|NaN/.test(svg), id);
  }
});
test('names accept fullwidth numbers, conventional synonyms, and equivalent kana', () => {
  assert.ok(isCorrectName('benzoicAcid', '　安息香酸　'));
  assert.ok(isCorrectName('benzoicAcid', 'あんそくこうさん'));
  assert.ok(isCorrectName('aspirin', 'アスピリン'));
  assert.ok(isCorrectName('tnt', '２，４，６－トリニトロトルエン'));
  assert.ok(isCorrectName('hydroxyazo', 'p－ヒドロキシアゾベンゼン'));
  assert.ok(isCorrectName('phenol', 'ふぇのーる'));
  assert.ok(isCorrectName('anilinium', '塩化アニリニウム'));
  assert.equal(normalizeName(' A-B（C） '), 'abc');
});
test('different isomers, missing groups, and empty names are not marked correct', () => {
  assert.equal(isCorrectName('salicylicAcid', ''), false);
  assert.equal(isCorrectName('salicylicAcid', '安息香酸'), false);
  assert.equal(isCorrectName('salicylicAcid', '4-ヒドロキシ安息香酸'), false);
  assert.equal(isCorrectName('xylene', 'm-キシレン'), false);
  assert.equal(isCorrectName('hydroxyazo', 'o-ヒドロキシアゾベンゼン'), false);
  assert.equal(isCorrectName('benzylAlcohol', 'フェノール'), false);
});
test('every canonical name and declared alias is accepted', () => {
  for (const [id, compound] of Object.entries(compounds)) {
    for (const name of [compound.name, ...compound.aliases]) assert.ok(isCorrectName(id, name), `${id}: ${name}`);
  }
});
test('hinted or incorrect attempts return for review; a clean correct retry clears review', () => {
  assert.equal(needsReview(undefined), false);
  assert.equal(needsReview({ helped: true, correct: false }), true);
  assert.equal(needsReview({ wrong: true, correct: true }), true);
  assert.equal(needsReview({ correct: true, helped: false, wrong: false }), false);
  assert.equal(needsReview({ correct: false }), true);
});
test('category sessions and shuffling preserve the exact requested questions', () => {
  const all = questionIds(); assert.equal(all.length, 49);
  for (const c of categories.filter(c => c.id !== 'all')) {
    const ids = questionIds(c.id);
    assert.ok(ids.length > 0);
    assert.ok(ids.every(id => questions.find(q => q.id === id).category === c.id));
    assert.deepEqual(shuffle(ids).sort(), [...ids].sort());
  }
});
test('all offline-precache files exist and referenced HTML element IDs are valid', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const files = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1] || 'index.html');
  for (const file of files) await access(new URL('../' + file, import.meta.url));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), `Missing element ${match[1]}`);
});

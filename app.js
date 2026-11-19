import { categories, compounds, questions } from './data.js';
import { isCorrectName, nextRevealStage, questionIds, needsReview, shuffle } from './logic.js';
import { moleculeSVG } from './molecules.js';
import { origins } from './origins.js';

const $ = id => document.getElementById(id);
const questionMap = new Map(questions.map(q => [q.id, q]));
const storageKey = 'benzene-note-v1';
const blankCurrent = () => ({ stage: 0, name: '', actions: [], helped: false, wrong: false, correct: false, finished: false, feedbackKind: '' });
const freshState = () => ({ version: 1, category: 'all', mode: 'normal', order: questionIds(), index: 0, current: blankCurrent(), records: {} });
const feedbackLabels = { missing: '名前を入力してください。', wrong: '名前が違います。', correct: '名前は正解です。' };
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || saved.version !== 1 || !Array.isArray(saved.order)) return freshState();
    saved.order = [...new Set(saved.order.filter(id => questionMap.has(id)))];
    if (!saved.order.length) return freshState();
    saved.index = Math.min(saved.order.length, Math.max(0, Number(saved.index) || 0));
    saved.category = categories.some(c => c.id === saved.category) ? saved.category : 'all';
    saved.mode = saved.mode === 'review' ? 'review' : 'normal';
    saved.records = saved.records && typeof saved.records === 'object' ? saved.records : {};
    saved.current = { ...blankCurrent(), ...saved.current };
    delete saved.current.feedback;
    saved.current.stage = Math.max(0, Math.min(2, Number(saved.current.stage) || 0));
    saved.current.actions = Array.isArray(saved.current.actions) ? saved.current.actions.slice(-250) : [];
    return saved;
  } catch { return freshState(); }
}
let state = restore();
let tool = 'pen', pointerId = null, activeAction = null, pendingFrame = null, toastTimer = null, saveFailureShown = false;
const canvas = $('drawingCanvas'), ctx = canvas.getContext('2d');
let canvasWidth = 1, canvasHeight = 1;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch {
    if (!saveFailureShown) { toast('このブラウザでは自動保存できません。画面を開いたまま学習できます。'); saveFailureShown = true; }
  }
}
const currentQuestion = () => questionMap.get(state.order[state.index]);
function remember(done = false) {
  const q = currentQuestion();
  if (!q) return;
  const c = state.current;
  if (c.helped || c.wrong || c.correct || done) {
    state.records[q.id] = { helped: c.helped, wrong: c.wrong, correct: c.correct, done: done || c.finished };
  }
}
function reviewIds() {
  return questionIds(state.category).filter(id => needsReview(state.records[id]));
}
function renderProgress() {
  const count = state.order.length;
  $('pageNumber').textContent = `${state.index + 1} / ${count}`;
  $('reviewMode').hidden = state.mode !== 'review';
  const countToReview = reviewIds().length;
  $('reviewCount').textContent = countToReview;
  $('reviewCount').hidden = countToReview === 0;
  $('reviewButton').disabled = countToReview === 0;
}
function render() {
  const q = currentQuestion();
  $('categorySelect').value = state.category;
  renderProgress();
  $('questionView').hidden = !q;
  $('completeView').hidden = Boolean(q);
  if (!q) {
    const correct = state.order.filter(id => state.records[id]?.correct && !state.records[id]?.helped && !state.records[id]?.wrong).length;
    $('completionSummary').textContent = `ヒントなしで正解 ${correct} / ${state.order.length}問\n復習 ${reviewIds().length}問`;
    $('completeReviewButton').hidden = !reviewIds().length;
    return;
  }
  const c = state.current;
  const showStructure = c.stage >= 1;
  const showName = c.stage >= 2;
  $('reactantName').textContent = compounds[q.from].name;
  $('questionAction').textContent = q.action;
  $('conditions').textContent = q.conditions;
  $('structureAnswer').hidden = !showStructure;
  $('writingLayout').classList.toggle('revealed', showStructure);
  $('answerMolecule').innerHTML = showStructure ? moleculeSVG(q.to, 'お手本の構造式') : '';
  $('nameInput').value = showName ? '' : c.name;
  $('nameEntry').hidden = showName;
  $('nameAnswer').hidden = !showName;
  $('nameAnswer').value = showName ? compounds[q.to].name : '';
  $('skipButton').hidden = showName;
  $('skipHint').textContent = showStructure ? '名前を見る' : '構造式を見る';
  const feedback = feedbackLabels[c.feedbackKind] ?? '';
  $('feedback').hidden = !feedback;
  $('feedback').textContent = feedback;
  $('feedback').classList.toggle('wrong', c.feedbackKind !== 'correct');
  $('explanation').hidden = !showName;
  $('explanationText').textContent = showName ? q.explanation : '';
  $('nameOriginText').textContent = showName ? origins[q.to] : '';
  $('nextButton').textContent = state.index === state.order.length - 1 ? '学習を終了' : '次の問題へ';
  $('undoButton').disabled = !c.actions.length;
  $('clearButton').disabled = !hasDrawing();
  requestAnimationFrame(resizeCanvas);
}
function hasDrawing() {
  const actions = state.current.actions;
  const start = actions.findLastIndex(a => a.type === 'clear');
  return actions.slice(start + 1).some(a => a.type === 'pen' || a.type === 'ring');
}
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCanvas();
}
function drawRing(action) {
  const cx = action.x * canvasWidth, cy = action.y * canvasHeight;
  const r = Math.min(canvasWidth * .19, canvasHeight * .24);
  const pts = Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos((i * 60 - 90) * Math.PI / 180), cy + r * Math.sin((i * 60 - 90) * Math.PI / 180)]);
  ctx.beginPath(); ctx.moveTo(...pts[0]); pts.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.stroke();
  for (const i of [0, 2, 4]) {
    ctx.beginPath(); ctx.moveTo(cx + (pts[i][0] - cx) * .77, cy + (pts[i][1] - cy) * .77);
    ctx.lineTo(cx + (pts[(i + 1) % 6][0] - cx) * .77, cy + (pts[(i + 1) % 6][1] - cy) * .77); ctx.stroke();
  }
}
function drawCanvas() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  for (const action of state.current.actions) {
    if (action.type === 'clear') { ctx.clearRect(0, 0, canvasWidth, canvasHeight); continue; }
    ctx.globalCompositeOperation = action.type === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#304d75'; ctx.fillStyle = '#304d75'; ctx.lineWidth = action.type === 'erase' ? 25 : 2.4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (action.type === 'ring') { drawRing(action); continue; }
    const points = action.points;
    if (!Array.isArray(points) || !points.length) continue;
    if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0][0] * canvasWidth, points[0][1] * canvasHeight, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(points[0][0] * canvasWidth, points[0][1] * canvasHeight);
    for (const p of points.slice(1)) ctx.lineTo(p[0] * canvasWidth, p[1] * canvasHeight);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  $('undoButton').disabled = !state.current.actions.length;
  $('clearButton').disabled = !hasDrawing();
}
function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return [Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 10000) / 10000,
    Math.round(Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * 10000) / 10000];
}
function finishStroke(event) {
  if (pointerId === null || event.pointerId !== pointerId) return;
  pointerId = null; activeAction = null;
  if (pendingFrame) { cancelAnimationFrame(pendingFrame); pendingFrame = null; }
  drawCanvas(); save();
}
canvas.addEventListener('pointerdown', event => {
  if (pointerId !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  activeAction = { type: event.pointerType === 'pen' && event.button === 5 ? 'erase' : tool, points: [pointFromEvent(event)] };
  state.current.actions.push(activeAction);
  if (state.current.actions.length > 250) state.current.actions.shift();
  drawCanvas();
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== pointerId || !activeAction) return;
  event.preventDefault();
  const coalesced = event.getCoalescedEvents?.();
  for (const pointEvent of (coalesced?.length ? coalesced : [event])) {
    const point = pointFromEvent(pointEvent), previous = activeAction.points.at(-1);
    if (point[0] !== previous[0] || point[1] !== previous[1]) activeAction.points.push(point);
  }
  if (!pendingFrame) pendingFrame = requestAnimationFrame(() => { pendingFrame = null; drawCanvas(); });
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, finishStroke);
new ResizeObserver(resizeCanvas).observe($('drawingPaper'));

function setTool(next) {
  tool = next;
  $('penTool').classList.toggle('active', next === 'pen'); $('penTool').setAttribute('aria-pressed', String(next === 'pen'));
  $('eraserTool').classList.toggle('active', next === 'erase'); $('eraserTool').setAttribute('aria-pressed', String(next === 'erase'));
  canvas.style.cursor = next === 'pen' ? 'crosshair' : 'cell';
}
$('penTool').addEventListener('click', () => setTool('pen'));
$('eraserTool').addEventListener('click', () => setTool('erase'));
$('undoButton').addEventListener('click', () => { state.current.actions.pop(); drawCanvas(); save(); });
$('clearButton').addEventListener('click', () => { state.current.actions.push({ type: 'clear' }); drawCanvas(); save(); toast('消去しました。「戻す」で取り消せます。'); });
$('insertRing').addEventListener('click', () => {
  const previousClear = state.current.actions.findLastIndex(a => a.type === 'clear');
  const rings = state.current.actions.slice(previousClear + 1).filter(a => a.type === 'ring').length;
  state.current.actions.push({ type: 'ring', x: [0.5, 0.25, 0.75][rings % 3], y: .54 });
  setTool('pen'); drawCanvas(); save();
});
$('nameInput').addEventListener('input', () => {
  state.current.name = $('nameInput').value;
  state.current.feedbackKind = '';
  $('feedback').hidden = true; save();
});
function checkAnswer() {
  if (state.current.stage >= 2) return;
  const q = currentQuestion(), c = state.current;
  c.name = $('nameInput').value.trim();
  if (!c.name) {
    c.feedbackKind = 'missing';
    render();
    $('nameInput').focus();
    return;
  }
  if (isCorrectName(q.to, c.name)) {
    c.correct = true; c.stage = 2; c.finished = true;
    c.feedbackKind = 'correct';
  } else {
    c.wrong = true;
    c.feedbackKind = 'wrong';
  }
  remember(); save(); render();
  if (c.correct) {
    $('nameAnswer').focus({ preventScroll: true });
    revealIntoView();
  }
}
$('checkButton').addEventListener('click', checkAnswer);
$('nameInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); $('nameInput').blur(); checkAnswer(); } });
function revealIntoView() {
  if (window.innerWidth <= 650) requestAnimationFrame(() => $('structureAnswer').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' }));
}
$('skipButton').addEventListener('click', () => {
  const c = state.current;
  if (c.stage >= 2) return;
  c.stage = nextRevealStage(c.stage); c.helped = true;
  c.feedbackKind = '';
  if (c.stage === 2) c.finished = true;
  remember(); save(); render();
  if (c.stage === 1) revealIntoView();
  else {
    $('nameAnswer').focus({ preventScroll: true });
    requestAnimationFrame(() => $('nameAnswer').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' }));
  }
});
$('nextButton').addEventListener('click', () => {
  remember(true); state.index++; state.current = blankCurrent(); setTool('pen'); save(); render();
  $('notebook').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' });
});
function startSession(ids, mode = 'normal') {
  state.order = ids; state.index = 0; state.mode = mode; state.current = blankCurrent(); setTool('pen'); save(); render();
}
function startReview() {
  remember(); const ids = reviewIds();
  if (!ids.length) { toast('復習する問題はまだありません。'); return; }
  startSession(ids, 'review');
}
$('categorySelect').innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
$('categorySelect').addEventListener('change', () => { remember(); state.category = $('categorySelect').value; startSession(questionIds(state.category)); });
$('shuffleButton').addEventListener('click', () => { remember(); startSession(shuffle(state.mode === 'review' ? state.order : questionIds(state.category)), state.mode); });
$('reviewButton').addEventListener('click', startReview);
$('completeReviewButton').addEventListener('click', startReview);
$('restartButton').addEventListener('click', () => startSession(questionIds(state.category)));

function buildLibrary() {
  const list = $('libraryList'); list.replaceChildren();
  for (const q of questions.filter(q => state.category === 'all' || q.category === state.category)) {
    const details = document.createElement('details'); details.className = 'reaction-item';
    const summary = document.createElement('summary'); summary.textContent = `${compounds[q.from].name}：${q.action}`;
    const answer = document.createElement('div'); answer.className = 'library-answer';
    const image = document.createElement('div'); image.innerHTML = moleculeSVG(q.to, `${compounds[q.to].name}の構造式`);
    const content = document.createElement('div'), title = document.createElement('h3'), conditions = document.createElement('p'), explanation = document.createElement('p');
    title.textContent = compounds[q.to].name; conditions.textContent = q.conditions; explanation.textContent = q.explanation;
    content.append(title, conditions, explanation); answer.append(image, content); details.append(summary, answer); list.append(details);
  }
}
function connectDialog(id, openId, closeId) {
  const dialog = $(id);
  $(openId).addEventListener('click', () => { if (id === 'libraryDialog') buildLibrary(); dialog.showModal(); });
  $(closeId).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
}
connectDialog('libraryDialog', 'libraryOpen', 'libraryClose');
connectDialog('aboutDialog', 'aboutOpen', 'aboutClose');
let resetArmed = false, resetTimer;
$('resetProgressButton').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true; $('resetProgressButton').textContent = 'もう一度押すとリセット'; $('resetMessage').textContent = '手書きと学習記録を消去します。';
    clearTimeout(resetTimer); resetTimer = setTimeout(() => { resetArmed = false; $('resetProgressButton').textContent = '学習記録をリセット'; $('resetMessage').textContent = ''; }, 6000); return;
  }
  state = freshState(); save(); render(); $('aboutDialog').close(); resetArmed = false;
  $('resetProgressButton').textContent = '学習記録をリセット'; $('resetMessage').textContent = ''; toast('学習記録をリセットしました。');
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);
render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });

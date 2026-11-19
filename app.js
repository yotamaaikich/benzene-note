import { categories, compounds, questions } from './data.js';
import { isCorrectName, nextRevealStage, questionIds, needsReview, shuffle } from './logic.js';
import { moleculeSVG } from './molecules.js';
import { origins } from './origins.js';

const $ = id => document.getElementById(id);
const questionMap = new Map(questions.map(q => [q.id, q]));
const storageKey = 'benzene-note-v1';
const blankCurrent = () => ({ stage: 0, name: '', actions: [], helped: false, wrong: false, correct: false, finished: false, feedback: '', feedbackKind: '' });
const freshState = () => ({ version: 1, category: 'all', mode: 'normal', order: questionIds(), index: 0, current: blankCurrent(), records: {} });
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
  const done = Math.min(count, state.index + (state.current.finished ? 1 : 0));
  $('progressText').textContent = `${done} / ${count}`;
  $('sessionProgress').max = count;
  $('sessionProgress').value = done;
  $('modeLabel').textContent = state.mode === 'review' ? '復習ノートの進み具合' : 'このノートの進み具合';
  $('pageNumber').textContent = `${String(Math.min(state.index + 1, count)).padStart(2, '0')} / ${count}`;
  $('reviewCount').textContent = reviewIds().length;
  $('reviewButton').disabled = !reviewIds().length;
}
function render() {
  const q = currentQuestion();
  $('categorySelect').value = state.category;
  renderProgress();
  $('questionView').hidden = !q;
  $('completeView').hidden = Boolean(q);
  if (!q) {
    const correct = state.order.filter(id => state.records[id]?.correct && !state.records[id]?.helped && !state.records[id]?.wrong).length;
    $('completionSummary').textContent = `${state.order.length}問のノートを終えました。\nヒントなしで名前が正解：${correct}問\nもう一度確認したい問題：${reviewIds().length}問`;
    $('completeReviewButton').hidden = !reviewIds().length;
    return;
  }
  const c = state.current;
  $('reactantName').textContent = compounds[q.from].name;
  $('questionAction').textContent = q.action;
  $('questionCategory').textContent = categories.find(cat => cat.id === q.category).name;
  $('conditions').textContent = q.conditions;
  $('structureAnswer').hidden = c.stage < 1;
  $('writingLayout').classList.toggle('revealed', c.stage >= 1);
  $('answerMolecule').innerHTML = c.stage >= 1 ? moleculeSVG(q.to, 'お手本の構造式') : '';
  $('nameInput').value = c.stage >= 2 ? compounds[q.to].name : c.name;
  $('nameInput').readOnly = c.stage >= 2;
  $('nameInput').classList.toggle('revealed-name', c.stage >= 2);
  $('checkButton').disabled = c.stage >= 2;
  $('skipButton').disabled = c.stage >= 2;
  $('skipHint').textContent = c.stage === 0 ? '構造式を見る' : c.stage === 1 ? '名前も見る' : '答えを表示済み';
  $('feedback').hidden = !c.feedback;
  $('feedback').textContent = c.feedback;
  $('feedback').classList.toggle('wrong', c.feedbackKind === 'wrong');
  $('explanation').hidden = c.stage < 2;
  $('explanationText').textContent = c.stage >= 2 ? q.explanation : '';
  $('nameOriginText').textContent = c.stage >= 2 ? origins[q.to] : '';
  $('nextButton').textContent = state.index === state.order.length - 1 ? 'ノートを終える' : '次の問題へ';
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
  $('canvasPlaceholder').hidden = hasDrawing();
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
  state.current.feedback = ''; state.current.feedbackKind = '';
  $('feedback').hidden = true; save();
});
function checkAnswer() {
  if (state.current.stage >= 2) return;
  const q = currentQuestion(), c = state.current;
  c.name = $('nameInput').value.trim();
  if (!c.name) { c.feedback = '名前を入力してから、答え合わせしよう。'; c.feedbackKind = 'wrong'; render(); $('nameInput').focus(); return; }
  if (isCorrectName(q.to, c.name)) {
    c.correct = true; c.stage = 2; c.finished = true;
    c.feedback = '名前は正解！ 構造式もお手本と見比べよう。'; c.feedbackKind = 'correct';
  } else {
    c.wrong = true; c.feedback = '名前をもう一度確認しよう。わからないときはスキップで見られます。'; c.feedbackKind = 'wrong';
  }
  remember(); save(); render();
  if (c.correct) revealIntoView();
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
  c.feedback = c.stage === 1 ? '構造式を表示しました。名前はまだ隠してあります。' : '名前も表示しました。下の解説で理由を確かめよう。';
  if (c.stage === 2) c.finished = true;
  remember(); save(); render();
  if (c.stage === 1) revealIntoView();
  else requestAnimationFrame(() => $('explanation').scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start' }));
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
  startSession(ids, 'review'); toast('わからなかった問題を、もう一度。');
}
$('categorySelect').innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
$('categorySelect').addEventListener('change', () => { remember(); state.category = $('categorySelect').value; startSession(questionIds(state.category)); });
$('shuffleButton').setAttribute('aria-label', 'この範囲の問題をシャッフルして最初から解く');
$('shuffleButton').addEventListener('click', () => { remember(); startSession(shuffle(state.mode === 'review' ? state.order : questionIds(state.category)), state.mode); toast('問題の順番をシャッフルしました。'); });
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

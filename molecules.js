import { compounds } from './data.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const line = (a, b, extra = '') => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${extra}/>`;
const text = (x, y, value, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${esc(value)}</text>`;
const vertices = (cx, cy, radius) => Array.from({ length: 6 }, (_, i) => [cx + radius * Math.cos((i * 60 - 90) * Math.PI / 180), cy + radius * Math.sin((i * 60 - 90) * Math.PI / 180)]);
function hexagon(cx, cy, radius, doubleEdges = [0, 2, 4]) {
  const pts = vertices(cx, cy, radius);
  let result = pts.map((a, i) => line(a, pts[(i + 1) % 6])).join('');
  for (const i of doubleEdges) {
    const a = pts[i], b = pts[(i + 1) % 6];
    result += line([cx + (a[0] - cx) * .77, cy + (a[1] - cy) * .77], [cx + (b[0] - cx) * .77, cy + (b[1] - cy) * .77]);
  }
  return result;
}
function aromatic(groups, cx = 165, cy = 119, r = 49) {
  let result = hexagon(cx, cy, r);
  const pts = vertices(cx, cy, r);
  for (const [position, group] of groups) {
    const angle = (position * 60 - 90) * Math.PI / 180;
    const p = pts[position];
    const end = [cx + (r + 22) * Math.cos(angle), cy + (r + 22) * Math.sin(angle)];
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const anchor = dx > .4 ? 'start' : dx < -.4 ? 'end' : 'middle';
    result += line(p, end) + text(end[0] + dx * 8, end[1] + dy * 11, group, anchor);
  }
  return result;
}
export function moleculeSVG(id, label = '構造式') {
  const compound = compounds[id];
  if (!compound) throw new Error(`Unknown compound: ${id}`);
  let body = '', width = 330, height = 232;
  if (compound.type === 'benzene') body = aromatic(compound.groups);
  if (compound.type === 'cyclohexane') body = hexagon(165, 116, 62, []);
  if (compound.type === 'hch') {
    body = hexagon(165, 116, 48, []);
    const pts = vertices(165, 116, 48), ends = vertices(165, 116, 73);
    body += pts.map((p, i) => line(p, ends[i]) + text(165 + (ends[i][0] - 165) * 1.19, 116 + (ends[i][1] - 116) * 1.19, 'Cl')).join('');
  }
  if (compound.type === 'naphthalene') {
    body = hexagon(117, 116, 55) + hexagon(117 + Math.sqrt(3) * 55, 116, 55, [0, 2]);
  }
  if (compound.type === 'polymer') {
    body = line([48, 40], [108, 40]) + text(125, 40, 'CH') + line([144, 40], [182, 40]) + text(202, 40, 'CH₂') + line([226, 40], [278, 40]);
    body += line([125, 53], [125, 83]) + hexagon(125, 132, 49);
    body += '<path d="M82 15 H70 V205 H82 M243 15 H255 V205 H243"/>' + text(275, 205, 'n');
  }
  if (compound.type === 'phthalicAnhydride') {
    body = hexagon(105, 116, 55);
    const pts = vertices(105, 116, 55);
    body += line(pts[1], [194, 77]) + line([194, 77], [217, 104]) + text(228, 116, 'O') + line([217, 128], [194, 155]) + line([194, 155], pts[2]);
    body += line([191, 75], [204, 48]) + line([197, 78], [210, 51]) + text(213, 35, 'O');
    body += line([191, 157], [204, 184]) + line([197, 154], [210, 181]) + text(213, 198, 'O');
  }
  if (compound.type === 'maleicAnhydride') {
    body = line([105, 77], [178, 63]) + line([178, 63], [208, 102]) + line([208, 130], [178, 169]) + line([178, 169], [105, 155]) + line([105, 155], [105, 77]);
    body += line([113, 85], [113, 147]) + text(218, 116, 'O');
    body += line([175, 60], [179, 36]) + line([182, 62], [186, 38]) + text(185, 23, 'O');
    body += line([175, 172], [179, 196]) + line([182, 170], [186, 194]) + text(185, 211, 'O');
  }
  if (compound.type === 'maleicAcid') {
    body = line([133, 84], [133, 148]) + line([141, 84], [141, 148]);
    body += line([133, 84], [98, 65]) + text(83, 58, 'H') + line([133, 148], [98, 167]) + text(83, 174, 'H');
    body += line([141, 84], [176, 65]) + text(184, 58, 'COOH', 'start') + line([141, 148], [176, 167]) + text(184, 174, 'COOH', 'start');
  }
  if (compound.type === 'azo') {
    width = 420;
    // 平たい六角形の左右頂点を使い、2つの環と N=N を一直線につなぐ。
    const flat = (cx, cy, r) => `<g transform="rotate(30 ${cx} ${cy})">${hexagon(cx, cy, r)}</g>`;
    body = flat(78, 116, 43) + line([121, 116], [151, 116]) + text(165, 116, 'N');
    body += line([178, 112], [207, 112]) + line([178, 120], [207, 120]) + text(221, 116, 'N') + line([235, 116], [265, 116]);
    body += flat(308, 116, 43) + line([351, 116], [374, 116]) + text(384, 116, compound.terminal, 'start');
    if (compound.terminal === 'NH₂') width = 440;
  }
  return `<svg class="molecule" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><g fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

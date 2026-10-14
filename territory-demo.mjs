import { applySharedActivity, captureSharedTile } from './shared-empire-rules.mjs';

const PLAYER = 'fictional-player';
const RIVAL = 'fictional-rival';
export const MAX_ROUTE_STEPS = 256;
export const MAX_ACTIVITIES = 32;
export const CELL_IDS = Object.freeze(Array.from({ length: 42 }, (_, i) => `demo-${Math.floor(i / 7)}-${i % 7}`));
const cells = new Set(CELL_IDS);

function position(index) {
  if (!cells.has(index)) throw new Error('Choose a hex on this map.');
  const [, row, col] = index.split('-').map(Number);
  return { row, col };
}

export function cellCenter(index) {
  const { row, col } = position(index);
  return { x: 70 + col * 58 + (row % 2) * 29, y: 60 + row * 50 };
}

export function neighboringCells(index) {
  const { row, col } = position(index);
  const offset = row % 2 ? 1 : -1;
  return [[row, col - 1], [row, col + 1], [row - 1, col], [row - 1, col + offset], [row + 1, col], [row + 1, col + offset]]
    .filter(([r, c]) => r >= 0 && r < 6 && c >= 0 && c < 7)
    .map(([r, c]) => `demo-${r}-${c}`);
}

export function appendRouteCell(route, index) {
  position(index);
  if (route.length >= MAX_ROUTE_STEPS) throw new Error('This route is full. Undo a step or clear it to keep exploring.');
  if (route.length && !neighboringCells(route.at(-1)).includes(index)) {
    throw new Error('Choose a neighboring hex to continue your route.');
  }
  return [...route, index];
}

function isInside(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// A fictional route joins neighboring hex centers. Explicit returns close
// loops; union their interiors, then deduplicate with all traversed hexes.
// This illustrates enclosure, not the app's GPS distance/tolerance checks.
export function analyzeRoute(route) {
  if (!Array.isArray(route) || route.length > MAX_ROUTE_STEPS) throw new Error('Invalid route.');
  const traversed = new Set();
  const enclosed = new Set();
  const lastVisit = new Map();
  for (let i = 0; i < route.length; i++) {
    position(route[i]);
    if (i && !neighboringCells(route[i - 1]).includes(route[i])) throw new Error('Route hexes must be neighbors.');
    traversed.add(route[i]);
    const previous = lastVisit.get(route[i]);
    if (previous !== undefined && i - previous >= 3) {
      const polygon = route.slice(previous, i).map(cellCenter);
      for (const index of CELL_IDS) if (isInside(cellCenter(index), polygon)) enclosed.add(index);
    }
    lastVisit.set(route[i], i);
  }
  const interior = new Set([...enclosed].filter(index => !traversed.has(index)));
  return { traversed: [...traversed], interior: [...interior], affected: [...new Set([...traversed, ...interior])] };
}

export function startingTiles() {
  const tiles = new Map();
  const own = ['demo-2-1', 'demo-3-1', 'demo-3-2', 'demo-4-1'];
  const rival = ['demo-1-4', 'demo-2-4', 'demo-2-5', 'demo-3-4', 'demo-3-5', 'demo-4-4'];
  for (const [owner, indexes] of [[PLAYER, own], [RIVAL, rival]]) {
    for (const index of indexes) {
      const tile = captureSharedTile({ index, ownerId: owner, areaSquareMeters: 100, activityId: 'fictional-start', capturedAt: 0 });
      tiles.set(index, owner === RIVAL ? { ...tile, reinforcementCount: 4, defense: 2 } : tile);
    }
  }
  return tiles;
}

export const EXAMPLE_ROUTES = Object.freeze({
  path: Object.freeze(['demo-3-1', 'demo-3-2', 'demo-3-3', 'demo-3-4', 'demo-3-5', 'demo-3-6']),
  loop: Object.freeze(['demo-0-2', 'demo-0-3', 'demo-0-4', 'demo-1-4', 'demo-2-5', 'demo-3-4', 'demo-4-4', 'demo-4-3', 'demo-4-2', 'demo-3-1', 'demo-2-1', 'demo-1-1', 'demo-0-2'])
});

export function playRoute(tiles, route, step) {
  if (!Number.isInteger(step) || step < 1 || step > MAX_ACTIVITIES) throw new Error('Reset the map to play more activities.');
  const analysis = analyzeRoute(route);
  if (!analysis.affected.length) throw new Error('Choose at least one hex first.');
  return applySharedActivity(tiles, PLAYER, 'fictional-activity-' + step, analysis.affected.map(index => ({ index, areaSquareMeters: 100 })), step);
}

function hexCount(count) { return `${count} hex${count === 1 ? '' : 'es'}`; }
function describeEffects(update) {
  const changes = [];
  if (update.capturedCount) changes.push(`${hexCount(update.capturedCount)} claimed`);
  if (update.fortifiedCount) changes.push(`${hexCount(update.fortifiedCount)} reinforced`);
  if (update.attackedCount) changes.push(`${hexCount(update.attackedCount)} attacked (−1 defense)`);
  if (update.conqueredCount) changes.push(`${hexCount(update.conqueredCount)} taken from the rival`);
  return changes.join('; ');
}

function mountDemo() {
  const svg = document.getElementById('demo-map');
  const play = document.getElementById('play-activity');
  const undo = document.getElementById('undo-route');
  const clear = document.getElementById('clear-route');
  const result = document.getElementById('demo-result');
  const feedback = document.getElementById('route-feedback');
  let tiles = startingTiles(), route = [], step = 0, focusIndex = CELL_IDS[0];
  const ns = 'http://www.w3.org/2000/svg';
  const element = (tag, attributes = {}, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  svg.setAttribute('role', 'group');
  const title = element('title', { id: 'demo-map-title' }, 'Build a route on the fictional hex map');
  const desc = element('desc', { id: 'demo-map-desc' }, 'Select neighboring hexes in order. Return to an earlier hex to close a loop. Arrow keys move focus; Enter or Space selects a hex. Numbers show defense.');
  const defs = element('defs');
  const pattern = element('pattern', { id: 'loop-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse' });
  pattern.append(element('path', { d: 'M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6', class: 'loop-hatch-line' }));
  defs.append(pattern);
  const cellLayer = element('g'), loopLayer = element('g', { 'aria-hidden': 'true', class: 'map-decoration' });
  const halo = element('polyline', { class: 'route-halo', 'aria-hidden': 'true' });
  const line = element('polyline', { class: 'route-line', 'aria-hidden': 'true' });
  const marker = element('circle', { r: 6, class: 'route-end', 'aria-hidden': 'true' });
  const labels = element('g', { 'aria-hidden': 'true', class: 'map-decoration' });
  const buttons = new Map(), polygons = new Map(), numbers = new Map(), overlays = new Map();
  for (const index of CELL_IDS) {
    const { x, y } = cellCenter(index);
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = (60 * i - 30) * Math.PI / 180;
      return `${(x + 31 * Math.cos(angle)).toFixed(1)},${(y + 31 * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
    const button = element('g', { role: 'button', 'data-cell': index, tabindex: -1, class: 'map-cell' });
    const polygon = element('polygon', { points });
    const overlay = element('polygon', { points, class: 'map-loop-fill', visibility: 'hidden' });
    const number = element('text', { x, y: y + 14, class: 'map-label', 'data-label-cell': index });
    button.append(polygon); cellLayer.append(button); loopLayer.append(overlay); labels.append(number);
    buttons.set(index, button); polygons.set(index, polygon); numbers.set(index, number); overlays.set(index, overlay);
    button.addEventListener('focus', () => setFocus(index));
    button.addEventListener('click', () => selectCell(index));
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCell(index); return; }
      const { row, col } = position(index);
      const targets = { ArrowLeft: [row, col - 1], ArrowRight: [row, col + 1], ArrowUp: [row - 1, col], ArrowDown: [row + 1, col] };
      if (targets[event.key]) {
        event.preventDefault();
        const [r, c] = targets[event.key], next = `demo-${r}-${c}`;
        if (cells.has(next)) { setFocus(next); buttons.get(next).focus(); }
      }
    });
  }
  svg.replaceChildren(title, desc, defs, cellLayer, loopLayer, halo, line, marker, labels);

  function setFocus(index) {
    buttons.get(focusIndex).setAttribute('tabindex', '-1');
    focusIndex = index;
    buttons.get(index).setAttribute('tabindex', '0');
  }
  function render() {
    const analysis = analyzeRoute(route);
    const traversed = new Set(analysis.traversed), interior = new Set(analysis.interior);
    const next = route.length ? new Set(neighboringCells(route.at(-1))) : new Set(CELL_IDS);
    for (const index of CELL_IDS) {
      const tile = tiles.get(index), { row, col } = position(index);
      const owner = tile ? (tile.ownerId === PLAYER ? 'own' : 'rival') : 'empty';
      polygons.get(index).setAttribute('class', `map-${owner}${traversed.has(index) ? ' map-route' : interior.has(index) ? ' map-interior' : ''}`);
      overlays.get(index).setAttribute('visibility', interior.has(index) ? 'visible' : 'hidden');
      numbers.get(index).textContent = tile ? tile.defense.toFixed(2) : '';
      numbers.get(index).setAttribute('class', 'map-label label-' + owner);
      const ownership = tile ? `${owner === 'own' ? 'yours' : 'rival territory'}, defense ${tile.defense.toFixed(2)}` : 'unclaimed';
      const selection = traversed.has(index) ? ', on your route' : interior.has(index) ? ', inside your loop' : '';
      const button = buttons.get(index);
      button.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${ownership}${selection}.`);
      button.setAttribute('aria-pressed', String(traversed.has(index)));
      button.setAttribute('data-owner', owner);
      button.setAttribute('data-interior', String(interior.has(index)));
      button.setAttribute('data-next', String(next.has(index)));
    }
    const points = route.map(index => { const { x, y } = cellCenter(index); return `${x},${y}`; }).join(' ');
    halo.setAttribute('points', points); line.setAttribute('points', points);
    marker.setAttribute('visibility', route.length ? 'visible' : 'hidden');
    if (route.length) { const { x, y } = cellCenter(route.at(-1)); marker.setAttribute('cx', x); marker.setAttribute('cy', y); }
    play.disabled = !route.length || step >= MAX_ACTIVITIES;
    undo.disabled = clear.disabled = !route.length;
    document.getElementById('route-count').textContent = String(analysis.traversed.length);
    document.getElementById('loop-count').textContent = String(analysis.interior.length);
    document.getElementById('affected-count').textContent = String(analysis.affected.length);
    document.getElementById('owned-count').textContent = String([...tiles.values()].filter(tile => tile.ownerId === PLAYER).length);
    document.getElementById('rival-count').textContent = String([...tiles.values()].filter(tile => tile.ownerId === RIVAL).length);
    document.getElementById('activity-count').textContent = String(step);
    document.getElementById('route-preview').textContent = step >= MAX_ACTIVITIES ? 'Reset the map to play more activities.' : !route.length ? 'Choose a starting hex, or load an example below.' : `Next activity: ${describeEffects(playRoute(tiles, route, step + 1))}.`;
    setFocus(focusIndex);
  }
  function selectCell(index) {
    try {
      route = appendRouteCell(route, index);
      setFocus(index);
      render();
      const analysis = analyzeRoute(route);
      feedback.textContent = analysis.interior.length ? `Loop encloses ${hexCount(analysis.interior.length)} beyond your route. Continue drawing or run this route.` : `Route has ${hexCount(analysis.traversed.length)}. Choose a neighboring hex; return to an earlier hex to enclose territory.`;
    } catch (error) { feedback.textContent = error.message; }
  }
  play.addEventListener('click', () => {
    if (!route.length || step >= MAX_ACTIVITIES) return;
    const update = playRoute(tiles, route, ++step);
    tiles = update.tiles;
    const analysis = analyzeRoute(route);
    result.textContent = `Activity ${step}: ${describeEffects(update)}. ${hexCount(analysis.traversed.length)} on the route + ${hexCount(analysis.interior.length)} inside loops. Each hex counted once.${step === MAX_ACTIVITIES ? ' Reset the map to play again.' : ' Choose any hex to start your next route.'}`;
    route = [];
    feedback.textContent = step === MAX_ACTIVITIES ? 'Route cleared. Reset the map to play more activities.' : 'Route cleared. Choose any hex to start a new route.';
    render();
  });
  undo.addEventListener('click', () => { route = route.slice(0, -1); render(); feedback.textContent = 'Last step removed. Your territory is unchanged.'; });
  clear.addEventListener('click', () => { route = []; render(); feedback.textContent = 'Route cleared. Your territory is unchanged. Choose a new starting hex.'; });
  document.getElementById('reset-demo').addEventListener('click', () => {
    tiles = startingTiles(); route = []; step = 0;
    result.textContent = 'Map reset. Choose a route to begin.';
    feedback.textContent = 'Choose any hex to start.';
    render();
  });
  for (const button of document.querySelectorAll('[data-example]')) button.addEventListener('click', () => {
    route = [...EXAMPLE_ROUTES[button.dataset.example]];
    render();
    feedback.textContent = button.dataset.example === 'loop' ? 'A loop is ready. The striped hexes inside count too. You can extend it before running.' : 'A route across all three territory types is ready. You can extend it before running.';
  });
  render();
  document.getElementById('static-explainer').hidden = true;
  document.getElementById('interactive-controls').hidden = false;
  document.getElementById('map-instructions').hidden = false;
  document.getElementById('route-legend').hidden = false;
}
if (typeof document !== 'undefined' && document.getElementById('demo-map')) mountDemo();

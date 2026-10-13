import { applySharedActivity, captureSharedTile } from './shared-empire-rules.mjs';

const PLAYER = 'fictional-player';
const RIVAL = 'fictional-rival';
const affected = ['demo-2-2', 'demo-2-3', 'demo-2-4', 'demo-3-2', 'demo-3-3', 'demo-3-4'];
const examples = {
  capture: { title: 'Claim a little space.', help: 'The six outlined cells are empty. One fictional activity captures them. Play again to reinforce them.', owner: null, reinforcement: 1, defense: 1 },
  reinforce: { title: 'Come back stronger.', help: 'The six outlined cells are already yours. Each activity adds reinforcement and repairs defense up to its new square-root maximum.', owner: PLAYER, reinforcement: 1, defense: 1 },
  contest: { title: 'A change of hands.', help: 'The six outlined cells belong to another fictional player and start with 2 defense. The first activity lowers it to 1; the second captures them.', owner: RIVAL, reinforcement: 4, defense: 2 }
};
export function startExample(name) {
  const example = examples[name];
  if (!example) throw new Error('Unknown example.');
  const tiles = new Map();
  if (example.owner) for (const index of affected) {
    const tile = captureSharedTile({ index, ownerId: example.owner, areaSquareMeters: 100, activityId: 'fictional-start', capturedAt: 0 });
    tiles.set(index, { ...tile, reinforcementCount: example.reinforcement, defense: example.defense });
  }
  return tiles;
}
export function playExample(tiles, step) {
  return applySharedActivity(tiles, PLAYER, 'fictional-activity-' + step, affected.map(index => ({index, areaSquareMeters:100})), step);
}

function mountDemo() {
  const svg = document.getElementById('demo-map');
  const controls = document.getElementById('interactive-controls');
  const play = document.getElementById('play-activity');
  const result = document.getElementById('demo-result');
  let name = 'capture';
  let tiles = startExample(name);
  let step = 0;
  const ns = 'http://www.w3.org/2000/svg';
  function element(tag, attributes, text) {
    const node = document.createElementNS(ns, tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function render() {
    const nodes = [element('title',{id:'demo-map-title'},'Fictional territory map'),element('desc',{id:'demo-map-desc'},'Six outlined cells are affected. Their defense is shown as a number. The text result describes every change.')];
    for(let row=0;row<6;row++) for(let col=0;col<7;col++){
      const index='demo-'+row+'-'+col;
      const x=70+col*58+(row%2)*29, y=60+row*50;
      const points=Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return (x+31*Math.cos(angle)).toFixed(1)+','+(y+31*Math.sin(angle)).toFixed(1);}).join(' ');
      const tile=tiles.get(index);
      const owner=tile?(tile.ownerId===PLAYER?'own':'rival'):'empty';
      nodes.push(element('polygon',{points,class:'map-'+owner+(affected.includes(index)?' map-affected':''), 'data-cell':index}));
      if(tile) nodes.push(element('text',{x,y,class:'map-label'},tile.defense.toFixed(2)));
    }
    svg.replaceChildren(...nodes);
    document.getElementById('owned-count').textContent=String([...tiles.values()].filter(tile=>tile.ownerId===PLAYER).length);
    document.getElementById('rival-count').textContent=String([...tiles.values()].filter(tile=>tile.ownerId===RIVAL).length);
    document.getElementById('sample-defense').textContent=(tiles.get(affected[0])?.defense??0).toFixed(2);
  }
  function reset(nextName=name){
    name=nextName;
    step=0;
    tiles=startExample(name);
    play.disabled=false;
    document.getElementById('scenario-title').textContent=examples[name].title;
    document.getElementById('scenario-help').textContent=examples[name].help;
    result.textContent='Ready. Play one activity to affect the six outlined cells.';
    render();
  }
  play.addEventListener('click',()=>{
    if(step>=32) return;
    const update=playExample(tiles,++step);
    tiles=update.tiles;
    const changes=[];
    if(update.capturedCount) changes.push(update.capturedCount+' empty cells captured');
    if(update.fortifiedCount) changes.push(update.fortifiedCount+' own cells reinforced');
    if(update.attackedCount) changes.push(update.attackedCount+' rival cells lost one defense each');
    if(update.conqueredCount) changes.push(update.conqueredCount+' rival cells captured');
    const sample=tiles.get(affected[0]);
    result.textContent='Activity '+step+': '+changes.join('; ')+'. Sample cell: '+sample.reinforcementCount+' reinforcement, '+sample.defense.toFixed(2)+' defense.'+(step===32?' Reset the example to start again.':'');
    play.disabled=step===32;
    render();
  });
  document.getElementById('reset-demo').addEventListener('click',()=>reset());
  for(const radio of document.querySelectorAll('input[name="scenario"]')) radio.addEventListener('change',()=>{if(radio.checked)reset(radio.value);});
  reset();
  document.getElementById('static-explainer').hidden=true;
  controls.hidden=false;
}
if(typeof document!=='undefined' && document.getElementById('demo-map')) mountDemo();

// One unit-radius quarter in one authored square; four adjacent quarters form
// a circle over 2x2 cells. All views and collision consume these same chords.
export const QUARTER_STEPS=16;
const config={nw:[.5,.5,Math.PI,['n','w']],ne:[-.5,.5,Math.PI*1.5,['n','e']],se:[-.5,-.5,0,['s','e']],sw:[.5,-.5,Math.PI*.5,['s','w']]};
const indexCache=new WeakMap();
export function quarterAt(map,x,z){let c=indexCache.get(map);if(!c||c.source!==map.quarterWalls){c={source:map.quarterWalls,index:new Map((map.quarterWalls||[]).map(q=>[`${q.x},${q.z}`,q]))};indexCache.set(map,c);}return c.index.get(`${x},${z}`);}
export const quarterSides=q=>config[q.corner][3];
export function quarterPoints(q){const [dx,dz,a]=config[q.corner];return Array.from({length:QUARTER_STEPS+1},(_,i)=>{const t=a+i/QUARTER_STEPS*Math.PI/2;return {x:Number((q.x+dx+Math.cos(t)).toFixed(12)),z:Number((q.z+dz+Math.sin(t)).toFixed(12))};});}
export function quarterFloor(q){const [dx,dz]=config[q.corner];return [{x:q.x+dx,z:q.z+dz},...quarterPoints(q)];}
export function quarterSegments(map){return (map.quarterWalls||[]).flatMap(q=>{const points=quarterPoints(q);return points.slice(1).map((b,i)=>({id:`curve-${q.x}-${q.z}-${i}`,quarter:q,a:points[i],b,offset:(config[q.corner][2]+i/QUARTER_STEPS*Math.PI/2)}));});}
export function quarterContains(q,p){const poly=quarterFloor(q);let sign=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],c=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);if(Math.abs(c)<1e-8)continue;if(sign&&Math.sign(c)!==sign)return false;sign=Math.sign(c);}return true;}
export function validateQuarterWalls(map){
 if(map.quarterWalls===undefined)return;
 if(!Array.isArray(map.quarterWalls)||map.quarterWalls.length>map.width*map.height)throw Error('Invalid quarter-round wall list.');
 const used=new Set();for(const q of map.quarterWalls){const key=`${q.x},${q.z}`;if(!Number.isInteger(q.x)||!Number.isInteger(q.z)||map.grid[q.z]?.[q.x]!=='.'||!Object.hasOwn(config,q.corner)||!['stone','wood'].includes(q.material||'stone')||used.has(key))throw Error('Invalid or duplicate quarter-round wall.');used.add(key);}
}
export function paintQuarter(map,x,z,corner,material='stone'){
 if(!['stone','wood'].includes(material))throw Error('Choose stone or wood.');
 if(map.version!==2||map.grid[z]?.[x]!=='.')throw Error('Place quarter-round walls on floor squares.');
 const previous=map.quarterWalls||[],next=previous.filter(q=>q.x!==x||q.z!==z);
 if(corner!=='erase'){
  if(!Object.hasOwn(config,corner))throw Error('Choose a quarter-round orientation.');
  const q={x,z,corner,material},sides=quarterSides(q),keys=sides.map(s=>s==='n'?`h:${x},${z}`:s==='s'?`h:${x},${z+1}`:s==='w'?`v:${x},${z}`:`v:${x+1},${z}`);
  if((map.edges||[]).some(e=>keys.includes(`${e.axis}:${e.x},${e.z}`)&&e.kind!=='wall'))throw Error('Remove doors/windows on the curve’s outer sides first.');
  map.edges=(map.edges||[]).filter(e=>!keys.includes(`${e.axis}:${e.x},${e.z}`));next.push(q);
 }
 map.quarterWalls=next;validateQuarterWalls(map);
}
export const WOOD_TEXTURES={wall:'assets/textures/exploration/wood-wall.png',ceiling:'assets/textures/exploration/wood-ceiling.png'};
export const ceilingKind=(map,x,z)=>map.ceiling?.[z]?.[x]==='w'?'wood':'stone';
export function paintCeiling(map,x,z,kind){if(map.grid[z]?.[x]!=='.')throw Error('Paint ceilings on floor.');const rows=map.ceiling?[...map.ceiling]:Array.from({length:map.height},()=> 'a'.repeat(map.width));rows[z]=rows[z].slice(0,x)+(kind==='wood'?'w':kind==='stone'?'s':'a')+rows[z].slice(x+1);map.ceiling=rows;}
export function validateCeiling(map){if(map.ceiling!==undefined&&(!Array.isArray(map.ceiling)||map.ceiling.length!==map.height||map.ceiling.some(row=>typeof row!=='string'||row.length!==map.width||/[^asw]/.test(row))))throw Error('Ceilings need one automatic/stone/wood marker per square.');}

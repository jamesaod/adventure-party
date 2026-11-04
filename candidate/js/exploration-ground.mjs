import {isOutdoor} from './exploration-environment.mjs?v=R238C262';
export const GRASS_TEXTURES=Object.freeze({short:'assets/textures/exploration/grass-short-v1.png',worn:'assets/textures/exploration/grass-worn-v1.png'});
export const GROUND_TEXTURES=Object.freeze({dirt:'assets/textures/exploration/dirt-path-v1.png',fringe:'assets/textures/exploration/grass-fringe-v1.png'});
export function groundKind(map,x,z){return ({g:'grass',d:'dirt',s:'stone'})[map.ground?.[z]?.[x]]||(isOutdoor(map,x,z)?'grass':'stone');}
export function validateGround(map){
 if(map.ground!==undefined&&(!Array.isArray(map.ground)||map.ground.length!==map.height||map.ground.some(row=>typeof row!=='string'||row.length!==map.width||/[^agds]/.test(row))))throw Error('Ground materials must match map dimensions and use automatic, grass, dirt or stone.');
}
export function paintGround(map,x,z,kind){
 const code={auto:'a',grass:'g',dirt:'d',stone:'s'}[kind];
 if(!code||!'.D'.includes(map.grid[z]?.[x]||'#'))throw Error('Paint ground on a floor square.');
 if(!map.ground)map.ground=Array.from({length:map.height},()=> 'a'.repeat(map.width));
 const row=[...map.ground[z]];row[x]=code;map.ground[z]=row.join('');
}
export function hasDirtGround(map){return (map.quarterWalls||[]).some(q=>q.outsideGround==='dirt')||map.grid.some((row,z)=>[...row].some((v,x)=>'.D'.includes(v)&&groundKind(map,x,z)==='dirt'));}
export const GROUND_NEIGHBORS=Object.freeze([[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]);
export function grassNeighborMask(map,x,z){
 let mask=0;GROUND_NEIGHBORS.forEach(([dx,dz],i)=>{if('.D'.includes(map.grid[z+dz]?.[x+dx]||'#')&&groundKind(map,x+dx,z+dz)==='grass')mask|=1<<i;});return mask;
}
export function hasOutdoorGrass(map){return (map.quarterWalls||[]).some(q=>q.outsideGround==='grass')||map.grid.some((row,z)=>[...row].some((v,x)=>'.D'.includes(v)&&groundKind(map,x,z)==='grass'));}
// One grass repeat covers one authored square (three metres), independent of
// the tactical hex subdivision and of the stone slab's repeat density.
export function grassMaterialMetrics(terrain){return {floorWidth:terrain.cellW,floorHeight:terrain.cellH};}

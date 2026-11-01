import {isOutdoor} from './exploration-environment.mjs?v=R238C238';
export const GRASS_TEXTURES=Object.freeze({short:'assets/textures/exploration/grass-short-v1.png',worn:'assets/textures/exploration/grass-worn-v1.png'});
export function groundKind(map,x,z){return isOutdoor(map,x,z)?'grass':'stone';}
export function hasOutdoorGrass(map){return (map.environment||[]).some((row,z)=>[...row].some((v,x)=>v==='o'&&'.D'.includes(map.grid[z]?.[x]||'#')));}
// One grass repeat covers one authored square (three metres), independent of
// the tactical hex subdivision and of the stone slab's repeat density.
export function grassMaterialMetrics(terrain){return {floorWidth:terrain.cellW,floorHeight:terrain.cellH};}

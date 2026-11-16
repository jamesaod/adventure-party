import {automaticShapes} from './combat-map-boundaries.mjs';
const autoCache=new WeakMap();
export function refreshAutomaticSurfaces(map){autoCache.set(map,automaticShapes(map));}
import {atPoint,contains,center,corner} from './combat-map-document.mjs';
import {insideShape} from './combat-map-shapes.mjs';
export const GRASS_TEXTURES=new Set(['grass','grass_ground']);
export function surfaceAt(map,x,y){const cell=atPoint(x,y);if(!contains(map,cell.q,cell.r))return null;for(let i=(map.terrain.shapes?.length||0)-1;i>=0;i--){const shape=map.terrain.shapes[i];if(insideShape({x,y},shape.points))return shape.texture;}const shapes=autoCache.get(map)||[];for(let i=shapes.length-1;i>=0;i--)if(insideShape({x,y},shapes[i].points))return shapes[i].texture;return map.terrain.cells[cell.r][cell.q];}
export function hexPoints(q,r){const c=center(q,r);return Array.from({length:6},(_,i)=>{const p=corner(i);return {x:c.x+p.x,y:c.y+p.y};});}
export function shadowVector(sun){const d=sun.direction,den=Math.max(.15,d.y);return sun.altitude>0?{x:-d.x/den,y:-d.z/den}:null;}
export function hull(points){const p=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),half=p=>{const out=[];for(const v of p){while(out.length>1&&cross(out.at(-2),out.at(-1),v)<=0)out.pop();out.push(v);}return out;};return [...half(p).slice(0,-1),...half(p.reverse()).slice(0,-1)];}

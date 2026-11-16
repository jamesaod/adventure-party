import {boundaryAt} from './combat-map-boundaries.mjs';
import {levelAt,validateElevations} from './combat-map-elevation.mjs';
import {validateShape} from './combat-map-shapes.mjs';
import {TEXTURES,TREES} from './combat-map-palette.mjs';
export const FORMAT='adventure-party-combat-map',LIMIT=128,RADIUS=32;
export const DIRECTIONS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export function dimensions(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>LIMIT||height>LIMIT)throw Error(`Dimensions must be whole numbers from 1 to ${LIMIT} hexes.`);}
export function createMap(width=24,height=16){dimensions(width,height);return {format:FORMAT,version:1,name:'Untitled battlefield',grid:{layout:'odd-r-rectangle',width,height,hexSizeFeet:10},terrain:{blend:'vertex-three-way-v1',cells:Array.from({length:height},()=>Array(width).fill('grass'))},objects:[]};}
export const contains=(map,q,r)=>Number.isInteger(q)&&Number.isInteger(r)&&q>=0&&r>=0&&q<map.grid.width&&r<map.grid.height;
export const center=(q,r)=>({x:Math.sqrt(3)*RADIUS*(q+(r&1)/2),y:1.5*RADIUS*r});
export const corner=(i)=>({x:RADIUS*Math.cos((30+60*i)*Math.PI/180),y:RADIUS*Math.sin((30+60*i)*Math.PI/180)});
export function roundHex(q,r){let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dz=Math.abs(z-r),dy=Math.abs(y+q+r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;return {q:x,r:z};}
export const axialCell=(q,r)=>({q:q-Math.floor(r/2),r});
export const offsetCell=(q,r)=>({q:q+Math.floor(r/2),r});
export const neighbor=(q,r,i)=>{const a=axialCell(q,r),d=DIRECTIONS[i];return offsetCell(a.q+d[0],r+d[1]);};
export const atPoint=(x,y)=>{const a=roundHex((Math.sqrt(3)*x/3-y/3)/RADIUS,2*y/(3*RADIUS));return offsetCell(a.q,a.r);};
export function hexLine(a,b){a=axialCell(a.q,a.r);b=axialCell(b.q,b.r);const n=Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));return Array.from({length:n+1},(_,i)=>roundHex(a.q+(b.q-a.q)*(n?i/n:0),a.r+(b.r-a.r)*(n?i/n:0))).map(p=>offsetCell(p.q,p.r));}
export function brush(map,q,r,radius=0){const a=axialCell(q,r),result=[];for(let dr=-radius;dr<=radius;dr++)for(let dq=Math.max(-radius,-dr-radius);dq<=Math.min(radius,-dr+radius);dq++){const p=offsetCell(a.q+dq,r+dr);if(contains(map,p.q,p.r))result.push(p);}return result;}
export function resizeMap(map,width,height){dimensions(width,height);const next=structuredClone(map);next.grid.width=width;next.grid.height=height;next.terrain.cells=Array.from({length:height},(_,r)=>Array.from({length:width},(_,q)=>map.terrain.cells[r]?.[q]||'grass'));if(map.terrain.elevations)next.terrain.elevations=Array.from({length:height},(_,r)=>Array.from({length:width},(_,q)=>levelAt(map,q,r)));if(map.terrain.boundaries)next.terrain.boundaries=Array.from({length:height},(_,r)=>Array.from({length:width},(_,q)=>map.terrain.boundaries[r]?.[q]||'soft'));next.objects=next.objects.filter(o=>contains(next,o.q,o.r));return next;}
// Every shared vertex has exactly the same owners and weights in all three hexes.
export function cornerWeights(map,q,r,i){if(boundaryAt(map,q,r)==='hard')return {[map.terrain.cells[r][q]]:1};const a=neighbor(q,r,i),b=neighbor(q,r,(i+1)%6),owners=[[q,r],[a.q,a.r],[b.q,b.r]].filter(([x,y])=>contains(map,x,y)&&boundaryAt(map,x,y)!=='hard'&&levelAt(map,x,y)===levelAt(map,q,r)),weights={};for(const [x,y]of owners){const id=map.terrain.cells[y][x];weights[id]=(weights[id]||0)+1/owners.length;}return weights;}
export function validateMap(value){
 if(!value||value.format!==FORMAT||value.version!==1)throw Error('Choose a version 1 Combat Map Editor export.');
 const {grid,terrain,objects}=value;dimensions(grid?.width,grid?.height);
 if(!['axial-parallelogram','odd-r-rectangle'].includes(grid.layout)||grid.hexSizeFeet!==10)throw Error('Unsupported hex layout or scale.');
 if(typeof value.name!=='string'||value.name.length>100)throw Error('Map name must contain at most 100 characters.');
 const textures=new Set(TEXTURES.map(t=>t.id)),trees=new Set(TREES.map(t=>t.id));
 if(terrain?.blend!=='vertex-three-way-v1'||!Array.isArray(terrain.cells)||terrain.cells.length!==grid.height||terrain.cells.some(row=>!Array.isArray(row)||row.length!==grid.width||row.some(id=>!textures.has(id))))throw Error('Terrain dimensions or texture IDs are invalid.');
 if(terrain.shapes!==undefined&&(!Array.isArray(terrain.shapes)||terrain.shapes.length>256))throw Error('At most 256 hard shapes are supported.');
 validateElevations(terrain.elevations,grid.width,grid.height);
 if(terrain.boundary!==undefined&&!['hard','soft'].includes(terrain.boundary))throw Error('Unsupported terrain boundary mode.');
 if(terrain.boundaries!==undefined&&(!Array.isArray(terrain.boundaries)||terrain.boundaries.length!==grid.height||terrain.boundaries.some(row=>!Array.isArray(row)||row.length!==grid.width||row.some(v=>!['hard','soft'].includes(v)))))throw Error('Invalid per-hex boundaries.');
 if(terrain.textureScales!==undefined&&(!terrain.textureScales||typeof terrain.textureScales!=='object'||Array.isArray(terrain.textureScales)||Object.entries(terrain.textureScales).some(([id,n])=>!textures.has(id)||!Number.isFinite(n)||n<.125||n>4)))throw Error('Texture scales must be between 0.125 and 4.');
 const shapes=terrain.shapes?.map(s=>validateShape(s,textures)).map(s=>grid.layout==='axial-parallelogram'?{...s,points:migratePoints(s.points)}:s);
 if(!Array.isArray(objects)||objects.length>grid.width*grid.height)throw Error('Invalid tree list.');const occupied=new Set(),ids=new Set();
 for(const o of objects){if(!o||o.type!=='tree'||!trees.has(o.assetId)||typeof o.id!=='string'||o.id.length>100||!o.id||ids.has(o.id)||!contains(value,o.q,o.r)||occupied.has(`${o.q},${o.r}`))throw Error('Trees must have unique IDs and occupy distinct map hexes.');occupied.add(`${o.q},${o.r}`);ids.add(o.id);}
 return {format:FORMAT,version:1,name:value.name,grid:{...grid,layout:'odd-r-rectangle'},terrain:{blend:terrain.blend,cells:terrain.cells.map(row=>[...row]),...(shapes?.length?{shapes}:{}),...(terrain.boundaries?{boundaries:terrain.boundaries.map(row=>[...row])}:{}),...(terrain.textureScales?{textureScales:{...terrain.textureScales}}:{}),...(terrain.boundary?{boundary:terrain.boundary}:{}),...(terrain.elevations?{elevations:terrain.elevations.map(row=>[...row])}:{})},objects:objects.map(({id,type,assetId,q,r})=>({id,type,assetId,q,r}))};
}
export const exportMap=map=>JSON.stringify(validateMap(map),null,2);
export function parseMap(text){if(text.length>4_000_000)throw Error('Map file is too large.');return validateMap(JSON.parse(text));}

// Convert drawn edges with a continuous row-wise shear; split at row boundaries
// so straight source edges remain continuous rather than tearing at row offsets.
function migratePoints(points){const shift=y=>{const row=y/48,n=Math.floor(row),t=row-n;return Math.sqrt(3)*RADIUS*(Math.floor(n/2)*(1-t)+Math.floor((n+1)/2)*t);};const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ts=[0];if(a.y!==b.y)for(let n=Math.floor(Math.min(a.y,b.y)/48)+1;n*48<Math.max(a.y,b.y);n++){const t=(n*48-a.y)/(b.y-a.y);if(t>0&&t<1)ts.push(t);}ts.sort((a,b)=>a-b);for(const t of ts){const y=a.y+(b.y-a.y)*t;out.push({x:a.x+(b.x-a.x)*t-shift(y),y});}}return out;}

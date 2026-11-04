import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {blankEdgeMap,terrainTransitionSample,paintCell,resizeMap,seedPack,parsePack,packIssues} from '../js/exploration-authoring.mjs';
import {groundKind,grassNeighborMask,hasDirtGround,validateGround} from '../js/exploration-ground.mjs';
import {grassCoverage,createGroundTileBank} from '../js/terrain-transition.mjs';
import {terrainForEncounter} from '../js/exploration-encounters.mjs';
const map=blankEdgeMap('terrain-test','Terrain Test');
paintCell(map,5,5,'ground-dirt');assert(hasDirtGround(map));assert.equal(groundKind(map,5,5),'dirt');
assert.equal(groundKind(map,4,5),'stone');paintCell(map,4,5,'ground-grass');assert(grassNeighborMask(map,5,5)&8);
assert.equal(grassCoverage(8,0,.5),1);assert.equal(grassCoverage(8,.5,.5),0);assert.equal(grassCoverage(0,0,0),0,'Stone/void do not create grass fringes');
paintCell(map,5,5,'ground-auto');assert.equal(groundKind(map,5,5),'stone');
assert.throws(()=>validateGround({...map,ground:['d']}),/dimensions/);assert.throws(()=>validateGround({...map,ground:map.ground.map(r=>r.replace('g','x'))}),/materials/);
const sample=terrainTransitionSample();assert.deepEqual(packIssues(seedPack(sample)),[]);
const restored=parsePack(JSON.stringify(seedPack(sample))).maps[0];assert.deepEqual(restored.ground,sample.ground);
const terrain=terrainForEncounter(restored,{x:11,z:13},new Set());assert.equal(terrain.spaces.find(s=>s.id==='floor-11-13').ground,'dirt');
resizeMap(restored,18,18);assert.equal(restored.ground[17][17],'a');assert.equal(restored.ground[13][11],'d');
// Distance fields on adjacent dirt cells must agree exactly along their seam,
// including diagonal-only grass, inside corners, bends and junctions.
const seams=blankEdgeMap('seams','Seams');seams.ground=seams.grid.map((r,z)=>[...r].map((_,x)=>(x*13+z*7)%5?'d':'g').join(''));
for(let z=1;z<14;z++)for(let x=1;x<14;x++){
 if(groundKind(seams,x,z)!=='dirt')continue;
 const a=grassNeighborMask(seams,x,z);
 for(let i=0;i<=20;i++){
  const t=i/20;
  if(groundKind(seams,x+1,z)==='dirt')assert(Math.abs(grassCoverage(a,1,t)-grassCoverage(grassNeighborMask(seams,x+1,z),0,t))<1e-12);
  if(groundKind(seams,x,z+1)==='dirt')assert(Math.abs(grassCoverage(a,t,1)-grassCoverage(grassNeighborMask(seams,x,z+1),t,0))<1e-12);
 }
}
const size=16,color=rgba=>({data:Uint8ClampedArray.from(Array.from({length:size*size},()=>rgba).flat())});
const makeCanvas=()=>{const c={};let source;const ctx={drawImage:image=>{source=image.data;},getImageData:()=>({data:source}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{c.result=image.data;}};c.getContext=()=>ctx;return c;};
const bank=createGroundTileBank({dirt:color([100,60,20,255]),grass:color([40,90,20,255]),fringe:color([100,200,40,180])},size,makeCanvas);
const bare=bank.get(0);assert.deepEqual([...bare.result.slice(0,4)],[100,60,20,255]);assert.equal(bank.get(256),bare,'Mask keys stay bounded to 256 variants');
const edge=bank.get(8);assert.equal(bank.get(8),edge,'No repeat composition during frame rendering');assert(edge.result.some((v,i)=>i%4===1&&v>90),'Transparent tufts contribute color in the blend band');assert(edge.result.every((v,i)=>i%4!==3||v===255),'Composed ground never has transparent holes');
const provenance=JSON.parse(readFileSync(new URL('../assets/textures/exploration/terrain-transition-generation-v1.json',import.meta.url)));
assert.equal(provenance.mode,'built-in image_gen');
for(const a of provenance.assets){const b=readFileSync(new URL('../assets/textures/exploration/'+a.file,import.meta.url));assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(b.readUInt32BE(16),a.width);assert.equal(b.readUInt32BE(20),a.height);}
// Decode RGBA alpha without imposing sprite-importer's hard-alpha policy.
const b=readFileSync(new URL('../assets/textures/exploration/grass-fringe-v1.png',import.meta.url));assert.equal(b[25],6);const w=b.readUInt32BE(16),h=b.readUInt32BE(20),chunks=[];
for(let offset=8;offset<b.length;){const n=b.readUInt32BE(offset);if(b.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(b.subarray(offset+8,offset+8+n));offset+=n+12;}
const raw=inflateSync(Buffer.concat(chunks)),stride=w*4,pixels=Buffer.alloc(h*stride);
const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
for(let y=0;y<h;y++)for(let x=0;x<stride;x++){const f=raw[y*(stride+1)],a=x>=4?pixels[y*stride+x-4]:0,up=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0;pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+[0,a,up,Math.floor((a+up)/2),paeth(a,up,c)][f])&255;}
let empty=0,soft=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)empty++;else if(pixels[i]===255)opaque++;else soft++;}assert(empty>0&&soft>0,'Fringe preserves real empty and translucent alpha');
console.log('PASS terrain paint/import/resize/handoff, continuous edges/corners/junctions, cached alpha composition, generated provenance and real transparent grass fringe');

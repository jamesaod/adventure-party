import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {configureSnowShelter,snowExposureAt} from '../js/combat-snow-shelter.mjs?v=natural-ac1';
const source=fs.readFileSync(new URL('../js/adventure-party.js?v=natural-ac1',import.meta.url),'utf8');
const functionText=name=>source.slice(source.indexOf('function '+name+'('),source.indexOf('\n}',source.indexOf('function '+name+'('))+2);
const context=vm.createContext({adventurePartyTreeEnvironment:{isBroadleaf:t=>!!t.species}});vm.runInContext(functionText('terrainHash')+'\n'+functionText('treeSizeScale'),context);
const scale=context.treeSizeScale;
const trees=Array.from({length:10000},(_,i)=>({x:i%100-50,y:Math.floor(i/100)-50}));
const sizes=trees.map(scale);assert(sizes.every(s=>s>=.33&&s<=1));assert(Math.min(...sizes)<.34&&Math.max(...sizes)>.99);
assert(new Set(sizes.map(s=>Math.floor(s*10))).size>=7);
for(const tree of trees.slice(0,100))assert.equal(scale(tree),scale({...tree,rotation:7,tileIndex:4}),'Size independent of view/model choice');
const tileSet={treeDrawHeight:240,id:'firs'},calls=[];
Object.assign(context,{activeCombatTerrainTileSet:()=>tileSet,directFirRendering:()=>true,hexCenter:()=>({x:50,y:75}),combatGpu:{},liveFirTreeRender:(set,tree,direct)=>calls.push(direct),game:{},key:(x,y)=>x+','+y,TERRAIN_TREE_IMAGES:new Map([['firs',{}]]),treeRotationFrame:()=>0});
vm.runInContext(fs.readFileSync(new URL('../js/combat-render-surfaces.js',import.meta.url),'utf8'),context);
for(const tree of [trees[sizes.indexOf(Math.min(...sizes))],trees[sizes.indexOf(Math.max(...sizes))]]){
 context.drawTreeDecoration(tree);const direct=calls.at(-1);
 assert.equal(direct.scale,240*scale(tree)/210);assert.equal(tree.outlineFrame.drawH,240*scale(tree));
 assert.equal(direct.center.x,50);assert.equal(direct.center.y,75,'Trunk anchor must not move with size');
}
configureSnowShelter([{x:-60,y:0,radius:40*.33},{x:60,y:0,radius:40}],[-120,-60,240,120],40);
assert.equal(snowExposureAt(-40,0),1,'Small canopy does not shelter full-size radius');
assert(snowExposureAt(80,0)<.6,'Large canopy retains wider shelter');
console.log('PASS stable 33–100% fir sizes, shared draw projection/outline anchoring and scaled snow shelter');


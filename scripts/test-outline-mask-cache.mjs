import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let reads=0,draws=0,fallen=false;
const frame={image:{},sx:0,sy:0,sourceTileWidth:100,sourceTileHeight:100,drawX:0,drawY:0,drawW:100,drawH:100};
const tree={x:0,y:0,outlineFrame:frame};const unit={entity:{alive:true,faction:'player',id:1},index:0,x:0,y:0,width:10,height:20};
const c={hiddenOutlineUnits:[unit],treeFallFor:()=>fallen?{}:null,hexCenter:()=>({x:10,y:20}),activeCombatTerrainTileSet:()=>({treeDrawHeight:100}),treeSizeScale:()=>1,getUnitEffect:()=>null,shouldRenderUnitUnderPartyVisibility:()=>true,isPlayerControlledUnit:()=>true,battlefieldZoom:1,combatLightingFrame:1,game:{},combatGpu:{unitOutline:true},directFirRendering:()=>true,document:{createElement:()=>({width:0,height:0,getContext:()=>({setTransform(){},clearRect(){},translate(){},drawImage(){},getImageData(){reads++;return {data:[0,0,0,255]}}})})},adventurePartyDirectUnits:{gpuOutline:()=>{draws++;return true}}};
vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/combat-render-units.js',import.meta.url),'utf8'),c);c.ordered=[{}, {tree}];const run=()=>vm.runInContext('drawHiddenUnitOutlines(ordered)',c);
run();c.ordered=[{}, {tree:{...tree}}];run();assert.equal(reads,1);assert.equal(draws,2,'animated unit silhouette still draws');
frame.drawX++;run();assert.equal(reads,2,'relative movement invalidates');
frame.image={};run();assert.equal(reads,3,'seasonal silhouette invalidates');
fallen=true;run();assert.equal(draws,4,'fallen canopy skips outline');
fallen=false;unit.width++;run();assert.equal(reads,4,'unit extent invalidates');
console.log('PASS mask reuse, moving outlines, seasonal silhouette, fall and resize');


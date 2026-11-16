import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createGpuOutline} from '../js/combat-gpu-outline.mjs';
const source=readFileSync('js/combat-render-units.js','utf8');
const helper=source.slice(source.indexOf('const hiddenUnitOutlineColors='),source.indexOf('const hiddenOutlineMaskCache='));
const rules=vm.createContext({isPlayerControlledUnit:u=>u.controller==='player'});vm.runInContext(helper,rules);
assert.equal(rules.hiddenUnitOutlineColor({faction:'player',controller:'ally'}),'#59aaff');
assert.equal(rules.hiddenUnitOutlineColor({faction:'enemy',controller:'mob'}),'#ff5757');
const cases=[['#59aaff',[89/255,170/255,1]],['#ff5757',[1,87/255,87/255]]];
let expected,current=null,painted=0;
const renderer={getRenderTarget:()=>current,setRenderTarget:t=>current=t,getClearColor:c=>c,getClearAlpha:()=>0,setClearColor(){},clear(){},render(scene){
 const rgb=scene.children[0].material.uniforms.color.value.toArray();
 rgb.forEach((value,i)=>{assert(Number.isFinite(value),'Outline color cannot contain NaN');assert(Math.abs(value-expected[i])<1e-4,'Faction color reaches GPU unchanged by daylight');});painted++;
}};
const pass=createGpuOutline(renderer,()=>{},()=>({width:100,height:100,zoom:1,anchor:{x:0,y:0}}),()=>{});
for(const [color,rgb] of cases)for(const daylight of [0,1])for(const active of [false,true]){
 expected=rgb;assert(pass.draw(()=>{},{mask:{width:16,height:16},left:0,top:0,color,daylight,active}));
}
assert.equal(painted,8);pass.dispose();
console.log('PASS allied blue and hostile red GPU outlines: finite shader colors, day/night and active/inactive units.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const start=source.indexOf('// Battlefield text size is separate');
const setup=source.slice(start,source.indexOf('const ui={',start));
const handler=source.slice(source.indexOf('function handleCombatKey('),source.indexOf('function handleCombatConditionsKey('));
const drawText=source.slice(source.indexOf('function drawWhiteBattlefieldText('),source.indexOf('function drawAimFriendlyFireWarning('));
function harness({stored=null,blocked=false,path='/candidate/'}={}){
 const storage=new Map(stored===null?[]:[['adventure-party:battlefield-font:'+path,stored]]),style=new Map(),status={};
 const canvas={save(){},restore(){},strokeText(){},fillText(){}};
 let draws=0;
 const context=vm.createContext({URL,Number,Math,String,ctx:canvas,game:{round:0},aimMode:true,
   document:{baseURI:'https://example.test'+path+'index.html',getElementById:id=>id==='combatScreen'?{style:{setProperty:(k,v)=>style.set(k,v)}}:status},
   localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');storage.set(key,value);}},
   draw:()=>draws++});
 vm.runInContext(setup+handler+drawText,context);
 const key=(key,code,extra={})=>{let prevented=false;context.handleCombatKey({key,code,target:{tagName:'BODY'},preventDefault(){prevented=true;},...extra});return prevented;};
 return {context,style,status,canvas,storage,key,draws:()=>draws};
}
const h=harness();
assert.equal(h.status.textContent,'TEXT 100% [− / +]');
for(const [key,code] of [['+','Equal'],['=','Equal'],['+','NumpadAdd']])assert.equal(h.key(key,code),true);
assert.equal(h.style.get('--combat-font-scale'),'1.3');
assert.equal(h.draws(),3,'Font changes redraw even before round one and while aiming');
h.context.drawWhiteBattlefieldText('Speech',10,20,{fontSize:14});
assert.match(h.canvas.font,/18.2px/,'Canvas speech uses the same 130% scale as panels');
assert.equal(h.key('-','Minus'),true);assert.equal(h.key('-','NumpadSubtract'),true);
assert.equal(h.style.get('--combat-font-scale'),'1.1');
for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true},...['INPUT','TEXTAREA','SELECT'].map(tagName=>({target:{tagName}})),{target:{tagName:'DIV',isContentEditable:true}}]){
 const before=h.draws();assert.equal(h.key('+','Equal',extra),false);assert.equal(h.key('-','Minus',extra),false);assert.equal(h.draws(),before,'Typing and modified shortcuts are untouched');
}
for(let i=0;i<30;i++)h.key('+','NumpadAdd');
assert.equal(h.style.get('--combat-font-scale'),'1.6');
const atMax=h.draws();h.key('+','Equal');assert.equal(h.draws(),atMax);
const saved=h.storage.get('adventure-party:battlefield-font:/candidate/');
assert.equal(harness({stored:saved}).style.get('--combat-font-scale'),'1.6','Preference restores after reload');
for(let i=0;i<30;i++)h.key('-','Minus');assert.equal(h.style.get('--combat-font-scale'),'0.8');
for(const stored of [null,'garbage','NaN','Infinity','0','999','-10'])assert.equal(harness({stored}).style.get('--combat-font-scale'),'1');
const blocked=harness({blocked:true});assert.equal(blocked.key('+','Equal'),true);assert.equal(blocked.style.get('--combat-font-scale'),'1.1');
const stable=harness({path:'/'});stable.key('+','Equal');assert.ok(stable.storage.has('adventure-party:battlefield-font:/'));
console.log('PASS battlefield font shortcuts: main/keypad keys, limits, before-turn/aiming use, canvas/CSS parity, persistence, unavailable storage and typing/modifier guards');

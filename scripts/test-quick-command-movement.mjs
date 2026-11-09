import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('js/adventure-party.js','utf8');
const start=source.indexOf('async function runQuickCommandPlayerTurn('),end=source.indexOf('function activateQuickCommand',start);
for(const id of ['player','friendly-orc']){
 const unit={id,alive:true,x:0,y:0,type:'fighter'};let moves=0,sleeps=[];
 const noop=()=>{};
 const ctx={quickCommandGeneration:1,quickCommandUnitId:id,quickCommandRunning:false,game:{active:id,over:false},getUnitById:()=>unit,isQuickCommandUnit:()=>moves<3,isPlayerControlledUnit:()=>true,exitAimMode:noop,closeCharacterSheet:noop,combatActionPauseRemaining:()=>0,activeEnemies:()=>[],chooseQuickCommandTarget:()=>({target:{},path:[{x:unit.x,y:0},{x:unit.x+1,y:0}]}),tryPlayerMove:async(dx,dy,options)=>{assert.equal(options.continuous,true);unit.x+=dx;moves++;unit.walkPresentation={};unit.walkStepClock={};},sleep:async ms=>sleeps.push(ms),updateUi:noop,draw:noop};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);await ctx.runQuickCommandPlayerTurn(1);
 assert.equal(moves,3);assert.deepEqual(sleeps,[],'production Quick Command must not pause between movement steps');assert.equal(unit.walkPresentation,undefined);assert.equal(unit.walkStepClock,undefined);assert.equal(ctx.quickCommandRunning,false);
}
console.log('PASS production Quick Command: Carl and friendly MOBs chain movement without sleeps and clean up');

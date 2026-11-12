import assert from 'node:assert/strict';
import {combatPresentationTestServices} from './combat-presentation-test-context.mjs';
import {readCombatFixture as readFileSync} from './combat-test-source.mjs';
import vm from 'node:vm';
import {createCombatFrameScheduler} from '../js/combat-frame-scheduler.mjs';
function harness(){
 let time=0,visible=true,active=true,id=0;const pending=new Map(),events=[];
 const scheduler=createCombatFrameScheduler({render:()=>events.push(['render',time]),requestFrame:fn=>{const n=++id;pending.set(n,fn);return n;},cancelFrame:n=>pending.delete(n),now:()=>time,visible:()=>visible,enabled:()=>active,onError:error=>{throw error;}});
 return {scheduler,pending,events,setVisible:v=>{visible=v;},setActive:v=>{active=v;},step(t){time=t;const work=[...pending.values()];pending.clear();for(const fn of work)fn(time);}};
}
for(const displayHz of [54,60,144]){
 const h=harness(),s=h.scheduler;let updates=0;
 const tick=()=>{updates++;s.request();s.requestTick(tick);};s.requestTick(tick);
 for(let i=0;i<=displayHz*3;i++){s.request();s.request();h.step(i*1000/displayHz);}
 const frames=h.events.filter(e=>e[0]==='render');assert(frames.length<=92&&frames.length>=89,`30 FPS target on ${displayHz} Hz display`);
 assert.equal(updates,frames.length,'All animation producers run before the shared render');
 assert(s.diagnostics().coalesced>100,'Duplicate requests must not redraw the world');
 for(let i=1;i<frames.length;i++)assert(frames[i][1]>frames[i-1][1],'Never present duplicate frames in one display callback');
 s.dispose();assert.equal(h.pending.size,0);
}
{
 const h=harness(),s=h.scheduler;let resolved=false;
 const p=s.nextFrame().then(v=>{resolved=v;});assert.equal(h.pending.size,1);
 s.requestTick(()=>h.events.push(['update',0]));h.step(0);await p;
 assert(resolved);assert.deepEqual(h.events.map(e=>e[0]),['update','render']);
 h.setVisible(false);s.request();assert.equal(h.pending.size,0);h.setVisible(true);s.wake();h.step(5000);
 assert.equal(h.events.filter(e=>e[0]==='render').length,2,'Visibility resume renders once, never a catch-up burst');
 s.request();h.step(5010);assert.equal(h.events.filter(e=>e[0]==='render').length,2,'A stall must not leave a backlog');
 const id=s.requestTick(()=>assert.fail('Cancelled callback ran'));s.cancelTick(id);h.step(5100);
 h.setActive(false);assert.equal(await s.nextFrame(),false);s.dispose();assert.equal(await s.nextFrame(),false);
}
// Exercise actual finite production animations with a simulated display clock.
const source=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const extract=(name,prefix='function ')=>{const a=source.indexOf(prefix+name+'(');assert(a>=0,name);return source.slice(a,source.indexOf('\n}',a)+2);};
let now=0;const samples=[];
const context={...combatPresentationTestServices(),addTerrainScorch(){},igniteFirTrees(){},performance:{now:()=>now},hexCenter:(x,y)=>({x:x*100,y:y*100}),arrowMissEndpoint:()=>({x:200,y:0}),projectileFx:null,fireballExplosionFx:null,
 presentCombatFrame:async()=>{samples.push({now,projectile:context.projectileFx&&{...context.projectileFx},explosion:context.fireballExplosionFx&&{...context.fireballExplosionFx}});now+=1000/30;}};
vm.createContext(context);vm.runInContext([extract('combatEffectDuration'),extract('animateArrowProjectile','async function '),extract('animateFireballExplosion','async function ')].join('\n'),context);
assert.equal(context.combatEffectDuration(280),560);
await context.animateArrowProjectile({x:0,y:0},{x:2,y:0},true);
const flight=samples.filter(s=>s.projectile);assert.equal(flight[0].projectile.t,0);assert.equal(flight.at(-1).projectile.t,1);
assert(flight.at(-1).now>=280&&flight.at(-1).now<340,'Physical missile flight runs at half speed');
assert(flight.some(s=>s.projectile.t>0&&s.projectile.t<1));assert.equal(context.projectileFx,null);
samples.length=0;now=0;await context.animateFireballExplosion({x:0,y:0},2,[{x:0,y:0,volumeDistance:0}]);
assert.equal(samples.find(s=>s.explosion).explosion.duration,1640);assert.equal(context.fireballExplosionFx,null);
const flame=extract('drawFireballExplosionFx'),breath=extract('drawDragonBreathFx'),spray=extract('drawColorSprayFx');
assert(!flame.includes('frame*frameMs')&&!breath.includes('frame*frameMs')&&!spray.includes('Math.floor(elapsed/frameMs)*frameMs'),'Visual geometry must use continuous elapsed time');
console.log('PASS shared 30 FPS pacing at 54/60/144 Hz, coalescing, update/render order, frame-await completion, hidden/cancelled work, no catch-up, half-speed production missiles/explosions and smooth geometry sampling');

assert(!readFileSync(new URL("../js/r223-los-cloud-aim-effects.js",import.meta.url),"utf8").includes("frame*frameMs"),"Active dragon breath override must also sample smooth geometry");

{
 const h=harness();for(let i=0;i<=180;i++){h.scheduler.request();h.step(i*1000/60+(i%2?.8:0));}
 assert(h.scheduler.diagnostics().renders>=88,"Sub-millisecond display jitter must not halve the intended cadence");h.scheduler.dispose();
}

{
 let calls=0;context.presentCombatFrame=async()=>{calls++;context.projectileFx=null;now+=1000/30;};
 await context.animateArrowProjectile({x:0,y:0},{x:2,y:0},true);assert.equal(calls,1,"Stopping a missile must not recreate it on the next frame");
 const replacement={newer:true};context.presentCombatFrame=async()=>{context.fireballExplosionFx=replacement;now+=1000/30;};
 await context.animateFireballExplosion({x:0,y:0},2,[{x:0,y:0,volumeDistance:0}]);
 assert.equal(context.fireballExplosionFx,replacement,"Cancelled old effects must not clear newer spell playback");
}

{
 const preview=readFileSync(new URL("../js/candidate-spell-previewer.js",import.meta.url),"utf8"),a=preview.indexOf("function spellPreviewRenderTick(){"),z=preview.indexOf("\n}",a)+2;
 const idle={spellPreviewRenderFrame:1,spellPreviewActive:true,spellPreviewRunning:false,currentScreen:"spell-preview",draw(){assert.fail("Stopped preview redrew");}};
 vm.runInNewContext(preview.slice(a,z)+"\nspellPreviewRenderTick();",idle);assert.equal(idle.spellPreviewRenderFrame,null);
}


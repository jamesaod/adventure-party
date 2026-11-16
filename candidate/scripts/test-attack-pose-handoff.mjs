import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('js/adventure-party.js','utf8');
function body(name){const start=source.indexOf('function '+name+'('),open=source.indexOf('{',start);let depth=1,i=open+1;for(;depth;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const definition={defaultPose:'stand',directionalSprites:{windup:{E:{image:{}}}},actionProfileId:'bow',windupDurationMs:100,actionDurationMs:200,actionPose:'attack'};
let now=0,finish;const timers=[];
const c={performance:{now:()=>now},unitPoseDefinition:()=>definition,unitPoseSupportsPose:()=>true,getUnitEffect:()=>null,shouldUseKoboldPronePose:()=>false,game:{},draw(){},setTimeout:f=>timers.push(f),sleep:()=>new Promise(r=>finish=r)};
vm.createContext(c);
vm.runInContext(['activeUnitPoseName','setTemporaryUnitPose','triggerUnitAttackPose'].map(body).join('\n')+'\nasync '+body('prepareUnitAttackWindup'),c);
const unit={alive:true};const pending=c.prepareUnitAttackWindup(unit);
now=140;timers[0]();assert.equal(c.activeUnitPoseName(unit),'windup','late frame must not display idle while release waits');
finish();await pending;c.triggerUnitAttackPose(unit);assert.equal(c.activeUnitPoseName(unit),'attack');
now=400;timers.at(-1)();assert.equal(c.activeUnitPoseName(unit),'stand','completed action returns to idle');
console.log('PASS delayed windup/release handoff preserves pose and normal idle expiry');

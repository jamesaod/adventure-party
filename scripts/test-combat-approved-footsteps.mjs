import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as T from '../assets/vendor/three/three.module.min.js';
import {sampleSnowFootfalls,setFootprintCells,clearSnowFootprints} from '../js/combat-snow-footprints.mjs?v=shore-snow1';
import {CombatPuddleEffects} from '../js/combat-puddle-effects.mjs';
const root=new URL('../assets/audio/sfx/terrain-steps/approved/',import.meta.url),meta=JSON.parse(fs.readFileSync(new URL('SOURCE.json',root)));
assert.equal(meta.mudPlaybackGain,meta.previousMudPlaybackGain/2);
for(const clip of meta.clips){assert(clip.durationSeconds<=.4);if(clip.surface==='water'){assert(clip.sourceStartSeconds>=0);assert(clip.sourceEndSeconds<=10);}assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(clip.file,root))).digest('hex'),clip.sha256);}
const group=new T.Group(),foot=new T.Bone();foot.name='LeftFoot';group.add(foot);
const camera=new T.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,4,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
let depth=0,plants=0,rigs=0;setFootprintCells(new Map([['a',{key:'a',amount:0,triangles:[{a:{x:-1000,y:-1000},b:{x:1000,y:-1000},c:{x:0,y:1000}}]}]]),()=>depth);
const unit={alive:true},view={matrix:[1,0,0,1,0,0]},base={x:0,y:0,width:200,height:200,anchor:{x:.5,y:.5},modelUnitsPerMetre:1,pixelsPerMetre:100,onGroundRig:()=>rigs++,onGroundFootfall:()=>plants++};
function sample(t,h,walking=true){foot.position.y=h;group.updateMatrixWorld(true);sampleSnowFootfalls(group,unit,{...base,poseSeconds:t,...walking?{walkSeconds:t}:{}},view,camera);}
clearSnowFootprints();sample(0,.1);sample(.03,.3);sample(.06,.1);assert.equal(plants,1,'Foot plant fires at landing');sample(.06,.1);sample(.09,.1);assert.equal(plants,1,'Duplicate draws and standing feet stay silent');assert(rigs>0);
sample(.12,.3,false);sample(.15,.1,false);assert.equal(plants,1,'Idle pose shifts do not play ground steps');depth=.1524;sample(.18,.3);sample(.21,.1);assert.equal(plants,1,'Snow keeps its own audio');
const calls=[],f={grass:true,snowEligible:1,points:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}]},fx=new CombatPuddleEffects({elevation:()=>0,water:()=>0,step:()=>calls.push('step')});fx.collect([f]);fx.walk([{entity:unit,x:0,y:0}]);fx.trackRig(unit);fx.walk([{entity:unit,x:25,y:0}]);assert.equal(calls.length,0,'Rig-driven steps suppress duplicate distance sounds');fx.plant(unit,25,0);assert.equal(calls.length,1);
clearSnowFootprints();console.log('PASS approved sources, puddle time limit, half mud gain, bone-plant cadence, idle/snow exclusion and fallback deduplication');

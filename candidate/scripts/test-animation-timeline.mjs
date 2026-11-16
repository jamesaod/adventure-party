import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {createAnimationTimeline,timelineLayout,editTimeline,timelineHandles,sourceToPlayback,sourceToTimeline,playbackToTimeline,timelineToPlayback} from '../js/animation-timeline.mjs';
import {buildBowSequence,bowSequenceTiming,bowSequenceSourceTiming} from '../js/bow-animation-sequence.mjs';
import {bowArrowStateAt,validateBowTiming} from '../js/equipment-visual-states.mjs';
import {workshopAttackTiming,createWorkshopAnimationSelector} from '../js/workshop-animation-runtime.mjs';
import {extractCombatFunction} from './combat-test-source.mjs';
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const original={segments:[{id:'notch',label:'Notch',duration:2.5,start:0,end:2.5,speed:1,blendOut:.08},{id:'shoot',label:'Shoot',duration:2,start:0,end:2,speed:1}],events:[{id:'draw',label:'String attaches',segmentId:'notch',value:.625,beforeBlend:true},{id:'release',label:'Arrow release',segmentId:'shoot',value:.3}]};
let edited=editTimeline(original,'notch:start',.2);edited=editTimeline(edited,'notch:end',2);edited=editTimeline(edited,'shoot:start',.1);edited=editTimeline(edited,'shoot:end',1.7);
assert.equal(timelineLayout(edited).extent,4.5,'Trims cannot shorten or rescale the source ruler');
assert.equal(timelineLayout(edited).segments[1].offset,2.5,'The next source clip never slides into trimmed space');
assert.equal(sourceToTimeline(edited,'release',.3),0,'Unknown segment is harmless');
assert.equal(sourceToTimeline(original,'shoot',.3),sourceToTimeline(edited,'shoot',.3),'An untrimmed event retains its position');
close(timelineLayout(edited).duration,1.8+1.6-.08);
close(timelineToPlayback(edited,0),0,'Grey leading range seeks to retained start');
close(timelineToPlayback(edited,4.5),timelineLayout(edited).duration);
for(const t of [0,.5,1,1.71,1.75,2,3])close(timelineToPlayback(edited,playbackToTimeline(edited,t)),t);
assert.equal(original.segments[0].start,0,'Editing is non-mutating');
const short=editTimeline(edited,'notch:end',.23);
assert(timelineLayout(short).segments[0].blendOut<.03,'Transition fits the remaining source');
assert(short.events[0].value<=short.segments[0].end-short.segments[0].blendOut-.001+1e-8,'Trimming through an event keeps it valid');
const single={segments:[{id:'one',label:'Single',duration:2,start:.1,end:1.8,speed:2}],events:[{id:'draw',segmentId:'one',value:.4,before:'release'},{id:'release',segmentId:'one',value:1.1,after:'draw'}]};
assert(editTimeline(single,'draw',1.5).events[0].value<1.1,'Attach cannot cross release');
assert(editTimeline(single,'release',0).events[1].value>.4,'Release cannot cross attach');
for(const [handle,value] of [['one:start',1.5],['one:end',.2]]){const trimmed=editTimeline(single,handle,value),[draw,release]=trimmed.events;assert(draw.value<release.value);assert(draw.value>=trimmed.segments[0].start);assert(release.value<=trimmed.segments[0].end);}
close(timelineToPlayback(single,sourceToTimeline(single,'one',.8)),.35);
// Different source speeds and a blend have one reversible source/runtime mapping.
const recipe={notch:{clipId:'n',start:.2,end:2,speed:1.5},shoot:{clipId:'s',start:.1,end:1.7,speed:.7},blend:.08,draw:.65,release:.45};
const timing=bowSequenceTiming(recipe),restored=bowSequenceSourceTiming(recipe,timing);close(restored.draw,recipe.draw);close(restored.release,recipe.release);
const make=(id,duration)=>({id,name:id,duration,data:THREE.AnimationClip.toJSON(new THREE.AnimationClip(id,duration,[new THREE.VectorKeyframeTrack('hips.position',[0,duration],[0,0,0,1,0,0])]))});
const draft={clips:[make('n',2.5),make('s',2)],assignments:{}};
const source=readFileSync('js/mob-workshop.mjs','utf8');
const markerFields={bowMarkers:{checked:true},bowDraw:{value:.1},bowRelease:{value:1.5}},markerUI=vm.createContext({previewAssignment:{start:0,end:2,bowTiming:{pickup:.25,draw:.625,release:1.5}},$:id=>markerFields[id],validateBowTiming,syncSequenceEvents(){},refreshTimeline(){}});
vm.runInContext(extractCombatFunction(source,'refreshBowTiming'),markerUI);markerUI.refreshBowTiming();
assert(markerUI.previewAssignment.bowTiming.pickup<.1,'An earlier attachment marker also keeps an explicit pickup before it');
let sequenceRecipe=structuredClone(recipe),serial=0;
const ui=vm.createContext({model:{},draft,structuredClone,readSequenceRecipe:()=>structuredClone(sequenceRecipe),buildBowSequence,
 bound:c=>THREE.AnimationClip.parse(c.data),portable:c=>THREE.AnimationClip.toJSON(c),
 addClip(c){const record={id:'combined-'+serial++,name:c.name,duration:c.duration,data:THREE.AnimationClip.toJSON(c)};draft.clips.push(record);return record;},
 assignClip(d,slot,a){d.assignments[slot]=[structuredClone(a)];},renderSlots(){},status(){},seekPreviewTime(){},
 choose(id,a){ui.selected=id;ui.previewAssignment=a;}
});
vm.runInContext(extractCombatFunction(source,'composeSequence'),ui);
ui.composeSequence(true,{paused:true});const assigned=structuredClone(draft.assignments.bow[0]),savedClip=structuredClone(draft.clips.find(c=>c.id===assigned.clipId));
sequenceRecipe={...sequenceRecipe,draw:.8,release:.7};ui.composeSequence(false,{paused:true});
assert.deepEqual(draft.assignments.bow[0],assigned,'Preview edits do not alter the assigned combat action');
assert.deepEqual(draft.clips.find(c=>c.id===assigned.clipId),savedClip,'Preview edits cannot mutate assigned animation tracks');
ui.composeSequence(true,{paused:true});const a=JSON.parse(JSON.stringify(draft.assignments.bow[0])),compiled=draft.clips.find(c=>c.id===a.clipId);
const expected=bowSequenceTiming(sequenceRecipe);close(a.bowTiming.draw,expected.draw);close(a.bowTiming.release,expected.release);
assert.deepEqual(JSON.parse(JSON.stringify(compiled.bowSequence)),sequenceRecipe,'Source trims, speeds and events survive serialization');
const combat=workshopAttackTiming(draft,'bow');close(combat.windupDurationMs,expected.release*1000);close(combat.actionDurationMs,(a.end-expected.release)*1000);
const select=createWorkshopAnimationSelector(draft),unit={alive:true,poseStartedAt:1000};
for(const [t,phase] of [[expected.draw-.01,'carry'],[expected.draw+.01,'nocked'],[expected.release+.01,'released']]){
 const frame=select(unit,'bow',undefined,1000+t*1000);assert.equal(bowArrowStateAt(frame.assignment,frame.time).phase,phase);
}
const html=readFileSync('mob-workshop.html','utf8');assert(html.includes('id="animationTimeline"'));assert(html.includes('id="time" hidden'));assert(source.includes('String attaches'));
// Exercise actual pointer/keyboard handlers across rerenders without a browser/GPU.
class Element{
 constructor(doc){this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.classList={add(){}};this.captures=new Set();this.width=600;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
 setAttribute(k,v){this.attributes[k]=v;}
 focus(){this.ownerDocument.activeElement=this;}
 closest(){return this.dataset.marker?this:this.parent?.closest()||null;}
 getBoundingClientRect(){return {left:100,width:this.width};}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);}
}
const doc={createElement(){return new Element(doc);}},host=new Element(doc),commits=[],seeks=[];
let locked=false,pauses=0;
const view=createAnimationTimeline({host,onPause(){pauses++;},isLocked:()=>locked,onSeek(t){seeks.push(t);view.setPlayhead(t);},onChange(next,meta){view.setModel(next);if(meta.commit)commits.push(meta);}});
view.setModel(edited);const rail=host.children.find(e=>e.className==='timeline-rail');
const button=id=>rail.children.find(e=>e.dataset.marker===id);
const pointer=(target,source)=>({target,button:0,pointerId:1,clientX:100+source/4.5*rail.width,preventDefault(){}});
rail.onpointerdown(pointer(button('draw').children[0],.625));rail.onpointermove(pointer(rail,.9));rail.onpointerup(pointer(rail,.9));
close(view.getModel().events[0].value,.9);assert.equal(commits.length,1);assert.equal(rail.hasPointerCapture(1),false);
button('draw').onkeydown({key:'ArrowRight',shiftKey:true,preventDefault(){},stopPropagation(){}});close(view.getModel().events[0].value,1);
assert.equal(commits.length,2);assert.equal(doc.activeElement.dataset.marker,'draw','Keyboard focus survives handle rerender');
const prior=JSON.stringify(view.getModel());rail.onpointerdown(pointer(button('notch:start'),.2));rail.onpointermove(pointer(rail,.5));rail.onpointercancel();assert.equal(JSON.stringify(view.getModel()),prior,'Cancelled drag restores previous trims');
rail.width=300;rail.onpointerdown(pointer(button('draw'),1));rail.onpointermove(pointer(rail,1.2));rail.onpointerup(pointer(rail,1.2));close(view.getModel().events[0].value,1.2,'Resize keeps pointer conversion correct');
rail.onpointerdown(pointer(rail,0));rail.onpointerup(pointer(rail,0));assert.equal(seeks.at(-1),0,'Clicking grey seeks to retained start');
locked=true;const count=pauses;rail.onpointerdown(pointer(button('draw'),1.8));assert.equal(pauses,count,'Busy operations block timeline edits');
console.log('PASS timeline: fixed ruler/grey trims, pointer + keyboard + cancel + resize, marker ordering, source speeds/blend, isolated preview, saved sequence and combat attach/release timing.');

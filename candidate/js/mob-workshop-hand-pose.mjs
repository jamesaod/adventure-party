import {findHumanoidBone,humanoidFingerChains} from './humanoid-rig.mjs';
export const GRIP_PRESETS={authored:[0,0,0,0,0],relaxed:[12,15,18,20,10],shaft:[45,55,60,65,30],tight:[65,75,80,85,45]};
export function normalizeHandPose(p={}){p=p&&typeof p==='object'?p:{};const clamp=(v,n)=>Number.isFinite(+v)?Math.max(-n,Math.min(n,+v)):0;return {wrist:[0,1,2].map(i=>clamp(p.wrist?.[i],90)),curl:['index','middle','ring','pinky','thumb'].map((_,i)=>clamp(p.curl?.[i],110)),axis:['x','y','z'].includes(p.axis)?p.axis:'z',opposition:clamp(p.opposition,90)};}
// Always restore the authored pose before mixer evaluation. Corrections never compound.
export function createHandPose(THREE){let hand=null,chains=[],saved=[];return {
 bind(model){this.restore();hand=findHumanoidBone(model,'rightHand');chains=humanoidFingerChains(model,'right');return {hand:hand?.name||null,fingers:chains.map(c=>c.fingerName)};},
 restore(){for(const [bone,q] of saved)bone.quaternion.copy(q);saved=[];},
 apply(value){this.restore();if(!hand)return;const p=normalizeHandPose(value),bones=[hand,...chains.flatMap(c=>c.bones)];saved=bones.map(b=>[b,b.quaternion.clone()]);hand.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.wrist.map(THREE.MathUtils.degToRad),'XYZ')));const axis=new THREE.Vector3(...({x:[1,0,0],y:[0,1,0],z:[0,0,1]}[p.axis]));for(const chain of chains){const i=['index','middle','ring','pinky','thumb'].indexOf(chain.fingerName);chain.bones.forEach((bone,j)=>{bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(p.curl[i]*[.65,1,.75][j])));if(i===4&&j===0)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(p.opposition)));});}hand.updateWorldMatrix(true,true);},
 getHand(){return hand;}
};}

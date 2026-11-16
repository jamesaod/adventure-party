import {branchRestPose} from './oak-branch-rest.mjs';
import {continuousTrunk} from './oak-continuous-trunk.mjs?v=torn1';
import {createOakFallLeaves} from './combat-oak-fall-leaves.mjs?v=environment-architecture2';
import * as THREE from '../assets/vendor/three/three.module.min.js';
export const OAK_FALL_SECONDS=6;
export function oakFallPhase(state,now=performance.now()){
 const t=Math.max(0,(now-state.startedAt)/1000);
 return {t,impact:t>=2.6,settled:t>=OAK_FALL_SECONDS,angle:Math.PI/2*Math.min(1,(t/2.6)**2)};
}
// Eight transforms, shared GPU geometry/materials. No per-frame vertex processing.
export async function createOakFall(assets,family){
 assets={...assets,...Object.fromEntries(['green','fall','winter'].map(name=>[name,assets[name].clone()]))};
 const leaves=await createOakFallLeaves([assets.green,assets.fall],family);
 const group=new THREE.Group();group.userData.broadleaf=true;group.name='Oak fall prototype';
 const sets={};
 function prepare(breakType){if(!sets[breakType]){sets[breakType]=[assets.green,assets.fall,assets.winter].map(source=>continuousTrunk(source,{breakType,seed:family.base}));group.add(...sets[breakType].flatMap(t=>[t.moving,t.model,t.stump]));}return sets[breakType];}
 let trunks,standing;
 const stump=assets.stump,log=assets.fallen,limbs=assets.limbs;
 log.updateMatrixWorld(true);log.position.y-=new THREE.Box3().setFromObject(log).min.y;
 const pieces=[];
 limbs.traverse(mesh=>{if(!mesh.isMesh)return;mesh.userData.debrisLimb=true;
   mesh.geometry.computeBoundingBox();const center=new THREE.Vector3(...mesh.userData.origin).multiplyScalar(.18);
   const rest=branchRestPose(mesh.geometry,pieces.length);
   mesh.userData.restHeight={before:rest.before,after:rest.after};
   pieces.push({mesh,center,rest});
 });
 group.add(limbs);
 const particleGroup=new THREE.Group();particleGroup.name="Oak airborne leaves";particleGroup.userData.broadleaf=true;particleGroup.add(leaves.mesh);
 let lastState=null,lastSeason=-1,lastT=-1,lastBreak=null;
 const bounds=new THREE.Box3(new THREE.Vector3(-320,-5,-320),new THREE.Vector3(320,280,360));
 const api={group,particleGroup,resources:leaves.resources,prepareState(state,variant){const selected=prepare(state.breakType==='cut'?'cut':'torn')[variant-5];return variant===7?[]:leaves.landings(variant,state.leafWind||0,selected.cutHeight,selected.separation,state.localFallYaw||0);},setLeafRange:leaves.setRange,bounds,count:pieces.length,update(state,variant,now=performance.now(),ground=false,lighting=1){
   const breakType=state.breakType==='cut'?'cut':'torn';trunks=prepare(breakType);standing=trunks.map(t=>t.moving);for(const [type,set] of Object.entries(sets))if(type!==breakType)for(const t of set){t.moving.visible=false;t.model.visible=false;t.stump.visible=false;}
   const phase=oakFallPhase(state,now),t=Math.min(OAK_FALL_SECONDS,phase.t);
   const delta=state.localFallYaw||0,turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),delta);
   if(!state.preview)leaves.update(t,variant,ground,state.leafWind,trunks[variant-5].cutHeight,lighting,trunks[variant-5].separation,delta);
   if(lastState===state&&lastT===t&&lastSeason===variant&&lastBreak===breakType)return phase;
   lastState=state;lastT=t;lastSeason=variant;lastBreak=breakType;
   standing.forEach((m,i)=>{m.visible=!phase.impact&&i===variant-5;m.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),phase.angle).multiply(turn);m.position.set(0,trunks[i].cutHeight*(1-Math.cos(phase.angle)),-trunks[i].cutHeight*Math.sin(phase.angle)+trunks[i].separation*(1-Math.cos(phase.angle)));});
   trunks.forEach((trunk,i)=>{trunk.model.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2).multiply(turn);trunk.stump.quaternion.copy(turn);trunk.model.visible=phase.impact&&i===variant-5;trunk.stump.visible=i===variant-5;});
   stump.visible=false;limbs.visible=phase.impact;
   if(phase.impact){const u=Math.min(1,(t-2.6)/(OAK_FALL_SECONDS-2.6)),ease=1-(1-u)**3;
     pieces.forEach(({mesh,center,rest},i)=>{
       const a=(i+1)*2.399963,spread=12+i*3,floor=rest.floorAt(ease),fallenCenter=center.clone().applyQuaternion(turn);
       mesh.position.set((fallenCenter.x+Math.cos(a)*spread*ease)/.18,(floor+(1-u)*(10+Math.abs(fallenCenter.z)*.1)+Math.sin(Math.PI*u)*(2+i*.4))/ .18,(center.y+Math.sin(a)*spread*ease)/.18);
       mesh.quaternion.copy(rest.start).slerp(rest.end,ease);
     });
   }
   return phase;
 }};
 return api;
}

import {ARROW_VISUAL} from './arrow-visual-profile.mjs?v=R238C305';
import {createBowArrowPickup} from './bow-arrow-pickup.mjs?v=R238C312';
import {findHumanoidBone} from './humanoid-rig.mjs';

// Uses existing fitted bow coordinates; never rotates the weapon or rewrites the rig.
// All geometry is prepared at attachment time. Sampling performs no asset loading.
export function createBowString(THREE, model, hand) {
 let bow; model.traverse(o=>{if(o.userData.bowStringAnchors)bow=o;});
 if(!bow)return null;
 const data=JSON.parse(bow.userData.bowStringAnchors);
 const rest=data.rest.map(p=>new THREE.Vector3().fromArray(p));
 const bent=data.drawn.map(p=>new THREE.Vector3().fromArray(p));
 let rig=hand;while(rig.parent)rig=rig.parent;
 const nockBone=findHumanoidBone(rig,'rightIndex1')||findHumanoidBone(rig,'rightHand');
 const geometry=new THREE.CylinderGeometry(.0018,.0018,1,6);
 const material=new THREE.MeshStandardMaterial({color:0xd8c49d,roughness:1});
 const lines=[0,1].map(()=>{const m=new THREE.Mesh(geometry,material);m.name='ProceduralBowString';m.frustumCulled=false;bow.add(m);return m;});
 // One prepared arrow per attachment; follows the drawing hand until release.
 const arrow=new THREE.Group();arrow.name='DrawnBowArrow';arrow.userData.drawnArrow=true;bow.add(arrow);
 const visual=ARROW_VISUAL,metres=value=>value/visual.pixelsPerMetre;
 const wood=new THREE.MeshStandardMaterial({color:visual.wood,roughness:1});
 const feather=new THREE.MeshStandardMaterial({color:visual.feather,roughness:1,side:THREE.DoubleSide});
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(metres(visual.shaftWidth)/2,metres(visual.shaftWidth)/2,1,6),wood);shaft.position.y=.5;arrow.add(shaft);
 const head=new THREE.Mesh(new THREE.ConeGeometry(metres(visual.headWidth)/2,metres(visual.headLength)/visual.lengthMetres,4),new THREE.MeshStandardMaterial({color:visual.head,roughness:.85}));head.position.y=1+metres(visual.headLength)/visual.lengthMetres/2;arrow.add(head);
 for(let i=0;i<3;i++){const vane=new THREE.Mesh(new THREE.PlaneGeometry(metres(visual.featherWidth),metres(visual.featherLength)/visual.lengthMetres),feather);vane.position.y=metres(visual.featherStart+visual.featherLength/2)/visual.lengthMetres;vane.rotation.y=i*Math.PI*2/3;arrow.add(vane);}
 const pickup=createBowArrowPickup(THREE,rig,nockBone,arrow);
 const gripWorld=new THREE.Vector3(),tailWorld=new THREE.Vector3(),tipWorld=new THREE.Vector3();
 const tips=rest.map(p=>p.clone()),nock=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const nominal=rest[0].distanceTo(rest[1]);
 function at(t){for(let i=0;i<2;i++)tips[i].copy(rest[i]).lerp(bent[i],t);}
 function update(drawn,state=null,sizeScale=1){
  bow.updateWorldMatrix(true,false);
  let bend=0;
  if(drawn&&nockBone){
   nockBone.getWorldPosition(nock);bow.worldToLocal(nock);
   let lo=0,hi=1;for(let i=0;i<12;i++){const t=(lo+hi)/2;at(t);if(tips[0].distanceTo(nock)+tips[1].distanceTo(nock)>nominal)lo=t;else hi=t;}bend=(lo+hi)/2;
  }
  at(bend);
  if(!drawn||!nockBone)nock.copy(tips[0]).add(tips[1]).multiplyScalar(.5);
  if(bow.morphTargetInfluences)bow.morphTargetInfluences[bow.morphTargetDictionary?.Draw??0]=bend;
  for(let i=0;i<2;i++){
   direction.copy(nock).sub(tips[i]);const length=direction.length(),line=lines[i];
   line.position.copy(tips[i]).add(nock).multiplyScalar(.5);line.scale.set(1,length,1);
   if(length>1e-8)line.quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));
   line.updateMatrixWorld(true);
  }
  const carried=pickup?.sample(state,tailWorld,tipWorld,hand,sizeScale);
  arrow.visible=!!carried||(!!drawn&&!!nockBone);
  arrow.userData.drawnArrow=!!drawn&&arrow.visible;
  if(arrow.visible){
   if(!carried){
   nockBone.getWorldPosition(tailWorld);hand.getWorldPosition(gripWorld);
   direction.copy(gripWorld).sub(tailWorld);
   const drawDistance=direction.length();
   if(drawDistance>1e-6){
    // Keep a fixed map-sized shaft, with its rear at the string hand.
    tipWorld.copy(tailWorld).addScaledVector(direction,visual.lengthMetres*sizeScale/drawDistance);
   }else tipWorld.copy(tailWorld).add(new THREE.Vector3(0,visual.lengthMetres*sizeScale,0));
   }
    bow.worldToLocal(tailWorld);bow.worldToLocal(tipWorld);
    arrow.position.copy(tailWorld);direction.copy(tipWorld).sub(tailWorld);
    const length=direction.length();arrow.quaternion.setFromUnitVectors(up,direction.normalize());
    const scale=bow.getWorldScale(gripWorld);const radial=1/Math.max(1e-6,(Math.abs(scale.x)+Math.abs(scale.y)+Math.abs(scale.z))/3);
    const width=drawn?1:pickup?.widthScale(state)??1;
    arrow.scale.set(radial*sizeScale*width,length,radial*sizeScale*width);arrow.updateMatrixWorld(true);
  }
  // Exposed for fit diagnostics: >0 means this animation exceeds the bow's range.
  bow.userData.stringOverdraw=Math.max(0,(tips[0].distanceTo(nock)+tips[1].distanceTo(nock))/nominal-1);
 }
 update(false);
 return {update,getPickup:()=>pickup,calibratePickup:pickup?.calibrate,dispose:()=>pickup?.dispose()};
}


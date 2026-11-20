import * as T from '../assets/vendor/three/three.module.min.js';
import {createGiantImpactDust} from './giant-impact-dust.mjs?v=combat1';
import {sampleCorpseMeshFootprint} from './corpse-mesh-footprint.mjs';
export function giantDustAge(entity,now){
 if(!entity||entity.alive||entity.fled||!Number.isFinite(entity.deathPresentationStartedAt)||(entity.repositoryMobId!=='hill-giant'&&entity.type!=='mob:hill-giant'))return null;
 const age=(now-entity.deathPresentationStartedAt)/1000-2.4*.78;
 return age>=0&&age<3?age:null;
}
const footprints=new WeakMap();let dust,owner,started,rendererOwner;
const dark={intensity:0,position:new T.Vector3()};
export function renderGiantDust(renderer,scene,camera,asset,entity,now,factor,ambient,sun){
 const age=giantDustAge(entity,now);if(age===null)return false;
 let record=footprints.get(entity);
 if(!record||record.started!==entity.deathPresentationStartedAt){
  const outline=sampleCorpseMeshFootprint({root:asset.group,model:asset.group},T,{resolution:.13*factor,boundary:true});
  record={started:entity.deathPresentationStartedAt,yaw:asset.group.rotation.y,outline:outline.map(p=>({...p,x:p.x/factor,z:p.z/factor}))};footprints.set(entity,record);
 }
 if(!dust||rendererOwner!==renderer){dust?.dispose();dust=createGiantImpactDust(renderer,scene);rendererOwner=renderer;owner=null;}
 if(owner!==entity||started!==record.started){dust.emit(record.outline,new T.Vector3(),0);owner=entity;started=record.started;}
 dust.group.visible=true;dust.group.scale.setScalar(factor);dust.group.rotation.y=asset.group.rotation.y-record.yaw;
 try{dust.update(age);dust.render(camera,ambient,sun,dark);}finally{dust.group.visible=false;}
 return true;
}

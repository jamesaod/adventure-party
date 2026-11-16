import RAPIER from '../assets/vendor/rapier/rapier.mjs';
import * as T from '../assets/vendor/three/three.module.min.js';
export {RAPIER};
export const RAGDOLL_STEP=1/60;
const ZERO={x:0,y:0,z:0},X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0);
export async function createRagdollPhysics(){
 await RAPIER.init();
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=RAGDOLL_STEP;world.integrationParameters.numSolverIterations=6;
 const ground=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.15,0));
 world.createCollider(RAPIER.ColliderDesc.cuboid(30,.15,30).setFriction(.85).setCollisionGroups(0x0001ffff),ground);
 const wall=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,3.6));
 world.createCollider(RAPIER.ColliderDesc.cuboid(5,1,.18).setFriction(.7).setCollisionGroups(0x0001ffff),wall);wall.setEnabled(false);
 const active=new Map(),debris=new Map(),stats={steps:0,totalMs:0,peakMs:0,lastMs:0,settled:0,debrisSettled:0};
 function add(id,frames,{velocity,spin=1,lean=null,collideUnits=false,onSettle}={}){
  remove(id);const parts=[],byName=new Map(),members=1<<(id+1),filter=1|(collideUnits?(0x1fe&~members):0);
  for(const f of frames){
   const q=new T.Quaternion().copy(f.rotation),inverse=q.clone().invert(),localEnd=new T.Vector3().copy(f.end).sub(f.position).applyQuaternion(inverse),length=localEnd.length();
   const rigid=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(f.position.x,f.position.y,f.position.z).setRotation(q).setLinearDamping(.22).setAngularDamping(1.35).setCanSleep(true).setCcdEnabled(['hips','spine','head'].includes(f.name)));
   const collider=world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(.012,length*.5-f.radius*.55),f.radius).setTranslation(localEnd.x*.5,localEnd.y*.5,localEnd.z*.5).setRotation(new T.Quaternion().setFromUnitVectors(Y,localEnd.clone().normalize())).setMass(f.mass).setFriction(.85).setRestitution(.05).setCollisionGroups(((members<<16)|filter)>>>0),rigid);
   // Keep yaw calm so the impact lean reads clearly. The signed right-axis
   // vector produces a one-time torso lead: spine moves toward the lean while
   // hips lag slightly. It makes the pitch visible without a yaw controller.
   const lead={x:-(lean?.z||0),z:lean?.x||0},leadWeight=f.name==='hips'?-.16:f.name==='spine'?.34:0,leanWeight=f.name==='hips'?.65:f.name==='spine'?.4:0;
   rigid.setLinvel({x:(velocity?.x||0)+lead.x*leadWeight,y:velocity?.y||0,z:(velocity?.z||0)+lead.z*leadWeight},true);rigid.setAngvel({x:spin*(.6+(id%3)*.18)+(lean?.x||0)*leanWeight,y:0,z:spin*.25+(lean?.z||0)*leanWeight},true);
   const part={...f,rigid,collider,position:new T.Vector3(),rotation:new T.Quaternion(),prevPosition:new T.Vector3().copy(f.position),prevRotation:q.clone(),v:{x:0,y:0,z:0},w:{x:0,y:0,z:0}};
   part.position.copy(f.position);part.rotation.copy(q);parts.push(part);byName.set(f.name,part);
  }
  for(const part of parts){if(!part.parent)continue;const parent=byName.get(part.parent),p=part.rigid.translation(),a=new T.Vector3().copy(p).sub(parent.rigid.translation()).applyQuaternion(new T.Quaternion().copy(parent.rigid.rotation()).invert());
   const frame=new T.Quaternion().setFromUnitVectors(X,part.hingeAxis||X),f1=new T.Quaternion().copy(parent.rigid.rotation()).invert().multiply(frame),f2=new T.Quaternion().copy(part.rigid.rotation()).invert().multiply(frame);
   const desc=part.hinge?RAPIER.JointData.revolute(a,ZERO,X):RAPIER.JointData.spherical(a,ZERO);let joint=world.createImpulseJoint(desc,parent.rigid,part.rigid,true);
   // Rapier 0.21 classifies a free ball joint as Generic. Use its public
   // spherical wrapper for angular motors on that same joint handle.
   if(!part.hinge&&!(joint instanceof RAPIER.SphericalImpulseJoint))joint=new RAPIER.SphericalImpulseJoint(joint.rawSet,world.bodies,joint.handle);
   joint.setLocalFrame1(a,f1);joint.setLocalFrame2(ZERO,f2);joint.setContactsEnabled(false);
   if(part.hinge){joint.setLimits(-1.35,1.35);joint.configureMotorPosition(0,.5,.25);joint.setMotorMaxForce(1.5);}
   else for(const axis of [RAPIER.JointAxis.AngX,RAPIER.JointAxis.AngY,RAPIER.JointAxis.AngZ]){joint.configureMotorPosition(axis,0,part.name==='spine'?8:1.5,.6);joint.setMotorMaxForce(axis,part.name==='spine'?12:3);}
  }
  const actor={id,parts,byName,age:0,quiet:0,onSettle,grounded:false,reason:null};active.set(id,actor);return actor;
 }
 function addDebris(id,object,{halfExtents={x:.1,y:.1,z:.1},velocity=ZERO,angularVelocity=ZERO,mass=2,onSettle}={}){
  removeDebris(id);const half={x:Math.max(.02,halfExtents.x),y:Math.max(.02,halfExtents.y),z:Math.max(.02,halfExtents.z)},rigid=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(object.position.x,object.position.y,object.position.z).setRotation(object.quaternion).setLinearDamping(.28).setAngularDamping(.7).setCanSleep(true).setCcdEnabled(true));
  // Detached gear only collides with the fixed arena. It must not snag on
  // the ragdoll it just left or shove other units as it clears the blast.
  const collider=world.createCollider(RAPIER.ColliderDesc.cuboid(half.x,half.y,half.z).setMass(mass).setFriction(.72).setRestitution(.08).setCollisionGroups(((0x4000<<16)|1)>>>0),rigid);
  rigid.setLinvel(velocity,true);rigid.setAngvel(angularVelocity,true);const item={id,object,rigid,collider,age:0,quiet:0,onSettle};debris.set(id,item);return item;
 }
 function remove(id){const actor=active.get(id);if(!actor)return;for(const part of actor.parts)world.removeRigidBody(part.rigid);active.delete(id);}
 function removeDebris(id){const item=debris.get(id);if(!item)return;world.removeRigidBody(item.rigid);debris.delete(id);}
 function step(){
  if(!active.size&&!debris.size){stats.lastMs=0;return false;}
  const started=performance.now();for(const actor of active.values())for(const p of actor.parts){p.prevPosition.copy(p.position);p.prevRotation.copy(p.rotation);}
  world.step();const finished=[];
  for(const actor of active.values()){
   actor.age+=RAGDOLL_STEP;let speed=0,angular=0,sleeping=true,contact=false;
   for(const p of actor.parts){p.rigid.translation(p.position);p.rigid.rotation(p.rotation);p.rigid.linvel(p.v);p.rigid.angvel(p.w);speed=Math.max(speed,Math.hypot(p.v.x,p.v.y,p.v.z));angular=Math.max(angular,Math.hypot(p.w.x,p.w.y,p.w.z));sleeping&&=p.rigid.isSleeping();
    world.contactPairsWith(p.collider,other=>{if(other.parent()?.bodyType()!==RAPIER.RigidBodyType.Fixed)return;world.contactPair(p.collider,other,manifold=>{if(manifold.numSolverContacts()>0)contact=true;});});
   }
   actor.grounded=contact;actor.quiet=contact&&speed<.19&&angular<.5?actor.quiet+RAGDOLL_STEP:0;
   if(contact&&actor.age>2.8)for(const p of actor.parts){p.rigid.setLinearDamping(1.8);p.rigid.setAngularDamping(4);}
   if(contact&&(actor.quiet>.4||sleeping||(actor.age>6&&speed<.45))){actor.reason=actor.quiet>.4||sleeping?'rest':'bounded settle';finished.push(actor);}
  }
  const finishedDebris=[];
  for(const item of debris.values()){
   item.age+=RAGDOLL_STEP;const position=item.rigid.translation(),rotation=item.rigid.rotation(),velocity=item.rigid.linvel(),angularVelocity=item.rigid.angvel();item.object.position.set(position.x,position.y,position.z);item.object.quaternion.set(rotation.x,rotation.y,rotation.z,rotation.w);
   let contact=false;world.contactPairsWith(item.collider,other=>{if(other.parent()?.bodyType()!==RAPIER.RigidBodyType.Fixed)return;world.contactPair(item.collider,other,manifold=>{if(manifold.numSolverContacts()>0)contact=true;});});
   const slow=Math.hypot(velocity.x,velocity.y,velocity.z)<.14&&Math.hypot(angularVelocity.x,angularVelocity.y,angularVelocity.z)<.45;item.quiet=contact&&slow?item.quiet+RAGDOLL_STEP:0;
   if(contact&&(item.quiet>.28||item.rigid.isSleeping()||(item.age>5&&slow)))finishedDebris.push(item);
  }
  const elapsed=performance.now()-started;stats.steps++;stats.totalMs+=elapsed;stats.lastMs=elapsed;stats.peakMs=Math.max(stats.peakMs,elapsed);
  // Retain transforms, remove the dynamic bodies/joints entirely. Later steps
  // cannot wake finished units or continue charging them simulation work.
  for(const actor of finished){remove(actor.id);stats.settled++;actor.onSettle?.(actor);}
  for(const item of finishedDebris){removeDebris(item.id);stats.debrisSettled++;item.onSettle?.(item);}
  return true;
 }
 return {world,active,debris,stats,add,addDebris,remove,removeDebris,step,setWall:enabled=>wall.setEnabled(enabled),resetStats(){Object.assign(stats,{steps:0,totalMs:0,peakMs:0,lastMs:0,settled:0,debrisSettled:0});},dispose(){active.clear();debris.clear();world.free();}};
}

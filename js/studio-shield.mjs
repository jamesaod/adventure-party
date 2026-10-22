// Left-arm shield attachments are independent of right-hand weapon calibration.
// The Bronze Round Shield QA proxy preserves the uploaded model's measured
// diameter/thickness for pose testing; the full textured source remains the
// authoritative art reference until a binary-asset transfer pass.
export const STUDIO_SHIELDS = Object.freeze([
  Object.freeze({
    id:'bronze-round-shield',
    label:'Bronze Round Shield',
    visualClass:'round-shield',
    sourceSha256:'c908d84a286a005a050934f0b5bb409c6d42b2cbfc85ae0669637802375994e0',
    sourceBounds:Object.freeze({
      min:Object.freeze([-0.499755859375,0,-0.118408203125]),
      max:Object.freeze([0.499755859375,0.99951171875,0.118408203125])
    }),
    nativeScale:0.45,
    // Rev 69: keep the Rev 68 side/orientation and pull the shield inward
    // until it sits close to the forearm with roughly one-inch visual clearance.
    position:Object.freeze([0,0,0.04]),
    rotation:Object.freeze([0,0,0]),
    defaultSizePercent:100,
    presetRevision:3
  })
]);

export const SHIELD_MODEL_UNITS_PER_INCH=0.9774781465530396/75;
export const SHIELD_LIMITS=Object.freeze({
  sizePercent:Object.freeze({min:25,max:200,step:5}),
  position:Object.freeze({min:-1,max:1,step:0.005}),
  rotation:Object.freeze({min:-180,max:180,step:1}),
  distanceInches:Object.freeze({min:-3,max:6,step:0.25}),
  forearmSlideInches:Object.freeze({min:-8,max:8,step:0.25}),
  forearmRollDegrees:Object.freeze({min:-180,max:180,step:1})
});

const bounded=(value,fallback,range)=>Number.isFinite(value)
  ? Math.min(range.max,Math.max(range.min,value)) : fallback;

export function studioShield(id){
  return STUDIO_SHIELDS.find(shield=>shield.id===id)||null;
}

export function normalizeShield(value={}){
  const shield=studioShield(value?.leftHandShield);
  const preset=shield||STUDIO_SHIELDS[0];
  const presetRevision=Number.isFinite(shield?.presetRevision)?shield.presetRevision:0;
  const storedRevision=Number.isFinite(value?.presetRevision)?value.presetRevision:0;
  const migratePreset=!!shield&&presetRevision>storedRevision;
  const vector=key=>preset[key].map((fallback,axis)=>
    migratePreset?fallback:bounded(value?.[key]?.[axis],fallback,SHIELD_LIMITS[key]));
  return {
    version:2,
    presetRevision,
    leftHandShield:shield?.id||'none',
    sizePercent:migratePreset?(shield?.defaultSizePercent??100)
      :bounded(value?.sizePercent,shield?.defaultSizePercent??100,SHIELD_LIMITS.sizePercent),
    position:vector('position'),
    rotation:vector('rotation'),
    distanceInches:bounded(value?.distanceInches,0,SHIELD_LIMITS.distanceInches),
    forearmSlideInches:bounded(value?.forearmSlideInches,0,SHIELD_LIMITS.forearmSlideInches),
    forearmRollDegrees:bounded(value?.forearmRollDegrees,0,SHIELD_LIMITS.forearmRollDegrees)
  };
}

export function findLeftHand(model){
  let hand=null;
  model?.traverse(object=>{
    if(!object.isBone)return;
    const name=String(object.name).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(name==='lefthand'||name.endsWith('mixamoriglefthand')) hand||=object;
  });
  return hand;
}

export function leftForearmAxisLocal(THREE,hand){
  if(!hand?.isBone||!hand.parent)return new THREE.Vector3(1,0,0);
  hand.updateWorldMatrix(true,false);
  hand.parent.updateWorldMatrix(true,false);
  const handWorld=hand.getWorldPosition(new THREE.Vector3());
  const elbowWorld=hand.parent.getWorldPosition(new THREE.Vector3());
  const inverseHandWorld=hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const axis=elbowWorld.sub(handWorld).applyQuaternion(inverseHandWorld);
  return axis.lengthSq()>1e-10?axis.normalize():new THREE.Vector3(1,0,0);
}

function shieldOutwardAxisLocal(THREE,forearmAxis){
  const outward=new THREE.Vector3(0,0,1);
  outward.addScaledVector(forearmAxis,-outward.dot(forearmAxis));
  if(outward.lengthSq()<1e-10)outward.set(0,1,0);
  return outward.normalize();
}

export function createBronzeRoundShieldProxy(THREE){
  const group=new THREE.Group();
  group.name='BronzeRoundShieldProxy';
  group.userData.sourceSha256=STUDIO_SHIELDS[0].sourceSha256;
  const bronze=new THREE.MeshStandardMaterial({
    color:0x965220,roughness:0.55,metalness:0.65,side:THREE.DoubleSide
  });
  const darkBronze=new THREE.MeshStandardMaterial({
    color:0x5f3218,roughness:0.68,metalness:0.5,side:THREE.DoubleSide
  });

  // Uploaded source bounds are about 1.0 × 1.0 × 0.237. Build the QA proxy
  // centered on the hand grip with the same major proportions.
  const face=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.118,32,1,false),bronze);
  face.rotation.x=Math.PI/2;
  face.name='ShieldFace';
  group.add(face);

  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.47,0.035,8,32),darkBronze);
  rim.position.z=0.063;
  rim.name='ShieldRim';
  group.add(rim);

  const boss=new THREE.Mesh(new THREE.SphereGeometry(0.16,16,8),bronze);
  boss.scale.z=0.45;
  boss.position.z=0.075;
  boss.name='ShieldBoss';
  group.add(boss);

  return group;
}

export function createShieldAttachment(THREE,hand,model,settings){
  const value=normalizeShield(settings),shield=studioShield(value.leftHandShield);
  if(!hand?.isBone||!shield||!model?.isObject3D){
    throw new Error('A shield and a left-hand bone are required.');
  }
  const socket=new THREE.Group();
  socket.name='StudioLeftHandShield';
  socket.userData.studioShield=true;
  socket.add(model);
  hand.add(socket);
  const forearmAxis=leftForearmAxisLocal(THREE,hand);
  const outwardAxis=shieldOutwardAxisLocal(THREE,forearmAxis);

  function update(next){
    const normalized=normalizeShield(next);
    socket.position.fromArray(normalized.position)
      .addScaledVector(outwardAxis,normalized.distanceInches*SHIELD_MODEL_UNITS_PER_INCH)
      .addScaledVector(forearmAxis,normalized.forearmSlideInches*SHIELD_MODEL_UNITS_PER_INCH);
    const baseRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(
      ...normalized.rotation.map(degrees=>degrees*Math.PI/180),'XYZ'
    ));
    const roll=new THREE.Quaternion().setFromAxisAngle(
      forearmAxis,normalized.forearmRollDegrees*Math.PI/180
    );
    socket.quaternion.copy(baseRotation).premultiply(roll);
    socket.scale.setScalar(shield.nativeScale*normalized.sizePercent/100);
    socket.updateWorldMatrix(true,true);
  }
  update(value);
  return {socket,model,update,detach:()=>socket.removeFromParent()};
}

export function createStudioShield({THREE,disposeObject,onChange=()=>{}}){
  let model=null,settings=normalizeShield(),attachment=null,error='',disposed=false;
  const snapshot=()=>({
    settings:normalizeShield(settings),
    attached:!!attachment,
    leftHandBone:findLeftHand(model)?.name||null,
    error,
    socketWorldPosition:attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray()||null
  });
  const notify=()=>{if(!disposed)onChange(snapshot());};
  function detach(){
    if(!attachment)return;
    attachment.detach();
    disposeObject(attachment.model);
    attachment=null;
  }
  function select(value){
    if(disposed)return false;
    const next=normalizeShield(value);
    const sameShield=next.leftHandShield===settings.leftHandShield;
    settings=next;
    error='';
    if(sameShield&&attachment){
      attachment.update(settings);
      notify();
      return true;
    }
    detach();
    const shield=studioShield(settings.leftHandShield);
    if(!shield){notify();return true;}
    const hand=findLeftHand(model);
    if(!hand){
      error='This model has no supported left-hand bone for the shield.';
      notify();
      return false;
    }
    const asset=createBronzeRoundShieldProxy(THREE);
    attachment=createShieldAttachment(THREE,hand,asset,settings);
    notify();
    return true;
  }
  function setModel(next,value={}){
    detach();
    model=next;
    settings=normalizeShield();
    error='';
    return select(value);
  }
  function dispose(){
    disposed=true;
    detach();
    model=null;
  }
  return {snapshot,select,setModel,dispose};
}

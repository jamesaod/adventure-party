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
    // Rev 68: move the shield across the hand/forearm normal to the outside
    // of the arm, then flip the face so the boss still points outward.
    position:Object.freeze([0,0,0.14]),
    rotation:Object.freeze([0,0,0]),
    defaultSizePercent:100,
    presetRevision:2
  })
]);

export const SHIELD_LIMITS=Object.freeze({
  sizePercent:Object.freeze({min:25,max:200,step:5}),
  position:Object.freeze({min:-1,max:1,step:0.005}),
  rotation:Object.freeze({min:-180,max:180,step:1})
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
    version:1,
    presetRevision,
    leftHandShield:shield?.id||'none',
    sizePercent:migratePreset?(shield?.defaultSizePercent??100)
      :bounded(value?.sizePercent,shield?.defaultSizePercent??100,SHIELD_LIMITS.sizePercent),
    position:vector('position'),
    rotation:vector('rotation')
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

  function update(next){
    const normalized=normalizeShield(next);
    socket.position.fromArray(normalized.position);
    socket.rotation.set(...normalized.rotation.map(degrees=>degrees*Math.PI/180),'XYZ');
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
    settings=normalizeShield(value);
    detach();
    error='';
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

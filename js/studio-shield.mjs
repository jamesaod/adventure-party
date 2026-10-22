import { itemCatalogEntry } from './item-catalog.mjs?v=R238C71';

const WOODEN_SHIELD_ITEM=itemCatalogEntry('round-wooden-shield');
if(!WOODEN_SHIELD_ITEM?.appearance)throw new Error('Round Wooden Shield catalog appearance is required.');

export const STUDIO_SHIELDS=Object.freeze([
  Object.freeze({
    id:'round-wooden-shield',
    label:'Round Wooden Shield',
    visualClass:WOODEN_SHIELD_ITEM.appearance.visualClass,
    representation:WOODEN_SHIELD_ITEM.appearance.representation,
    sourceSha256:WOODEN_SHIELD_ITEM.appearance.source.originalSha256,
    sourceBounds:Object.freeze({
      min:Object.freeze([...WOODEN_SHIELD_ITEM.physical.sourceModelBounds.min]),
      max:Object.freeze([...WOODEN_SHIELD_ITEM.physical.sourceModelBounds.max])
    }),
    modelOrigin:Object.freeze([...WOODEN_SHIELD_ITEM.appearance.modelOrigin]),
    nativeScale:WOODEN_SHIELD_ITEM.appearance.nativeScale,
    // Rev 69 approved base mount. Rev 71 changes the art asset, not the mount.
    position:Object.freeze([0,0,0.04]),
    rotation:Object.freeze([0,0,0]),
    defaultSizePercent:100,
    presetRevision:4
  })
]);

const SHIELD_ALIASES=Object.freeze({
  'bronze-round-shield':'round-wooden-shield'
});

export const SHIELD_MODEL_UNITS_PER_INCH=0.9774781465530396/76;
export const SHIELD_LIMITS=Object.freeze({
  sizePercent:Object.freeze({min:25,max:200,step:5}),
  position:Object.freeze({min:-1,max:1,step:0.005}),
  rotation:Object.freeze({min:-180,max:180,step:1}),
  distanceInches:Object.freeze({min:-3,max:6,step:0.25}),
  forearmSlideInches:Object.freeze({min:-8,max:8,step:0.25}),
  forearmRollDegrees:Object.freeze({min:-180,max:180,step:1})
});

const bounded=(value,fallback,range)=>Number.isFinite(value)
  ?Math.min(range.max,Math.max(range.min,value)):fallback;

export function studioShield(id){
  const canonical=SHIELD_ALIASES[id]||id;
  return STUDIO_SHIELDS.find(shield=>shield.id===canonical)||null;
}

export function normalizeShield(value={}){
  const requested=SHIELD_ALIASES[value?.leftHandShield]||value?.leftHandShield;
  const shield=studioShield(requested);
  const preset=shield||STUDIO_SHIELDS[0];
  const presetRevision=Number.isFinite(shield?.presetRevision)?shield.presetRevision:0;
  const storedRevision=Number.isFinite(value?.presetRevision)?value.presetRevision:0;
  const migratePreset=!!shield&&presetRevision>storedRevision;
  const vector=key=>preset[key].map((fallback,axis)=>
    migratePreset?fallback:bounded(value?.[key]?.[axis],fallback,SHIELD_LIMITS[key]));
  return {
    version:3,
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
    if(name==='lefthand'||name.endsWith('mixamoriglefthand'))hand||=object;
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

export function createRoundWoodenShieldGeometry(THREE){
  const group=new THREE.Group();
  group.name='RoundWoodenShieldVisual';
  group.userData.sourceSha256=WOODEN_SHIELD_ITEM.appearance.source.originalSha256;
  group.userData.representation=WOODEN_SHIELD_ITEM.appearance.representation;

  const thickness=WOODEN_SHIELD_ITEM.physical.sourceModelExtent[2];
  const wood=new THREE.MeshStandardMaterial({
    color:0x7b4a24,roughness:0.92,metalness:0.02,side:THREE.DoubleSide
  });
  const darkWood=new THREE.MeshStandardMaterial({
    color:0x4a2b16,roughness:0.88,metalness:0.03,side:THREE.DoubleSide
  });
  const iron=new THREE.MeshStandardMaterial({
    color:0x655f55,roughness:0.62,metalness:0.48,side:THREE.DoubleSide
  });

  const face=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.10,64,1,false),wood);
  face.rotation.x=Math.PI/2;
  face.name='RoundWoodenShieldBody';
  group.add(face);

  const rim=new THREE.Mesh(new THREE.TorusGeometry(0.465,0.028,8,48),darkWood);
  rim.position.z=0.055;
  rim.name='RoundWoodenShieldRim';
  group.add(rim);

  const boss=new THREE.Mesh(new THREE.SphereGeometry(0.14,20,12),iron);
  boss.scale.z=0.45;
  boss.position.z=Math.min(thickness/2-0.004,0.06);
  boss.name='RoundWoodenShieldBoss';
  group.add(boss);

  for(const x of [-0.30,-0.15,0,0.15,0.30]){
    const seam=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.86,0.006),darkWood);
    seam.position.set(x,0,0.053);
    seam.name='RoundWoodenShieldPlankSeam';
    group.add(seam);
  }
  return group;
}

export async function createRoundWoodenShieldModel(THREE){
  return createRoundWoodenShieldGeometry(THREE);
}

export function createShieldAttachment(THREE,hand,model,settings){
  const value=normalizeShield(settings),shield=studioShield(value.leftHandShield);
  if(!hand?.isBone||!shield||!model?.isObject3D){
    throw new Error('A shield and a left-hand bone are required.');
  }
  const socket=new THREE.Group();
  socket.name='StudioLeftHandShield';
  socket.userData.studioShield=true;

  const origin=new THREE.Group();
  origin.name='ShieldModelOrigin';
  origin.position.fromArray(shield.modelOrigin).multiplyScalar(-1);
  origin.add(model);
  socket.add(origin);
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
  return {socket,origin,model,update,detach:()=>socket.removeFromParent()};
}

export function createStudioShield({THREE,loadAsset,disposeObject,onChange=()=>{}}){
  let model=null,settings=normalizeShield(),attachment=null,loading=false,error='',request=0,disposed=false;
  const snapshot=()=>({
    settings:normalizeShield(settings),
    attached:!!attachment,
    leftHandBone:findLeftHand(model)?.name||null,
    loading,error,
    socketWorldPosition:attachment?.socket.getWorldPosition(new THREE.Vector3()).toArray()||null
  });
  const notify=()=>{if(!disposed)onChange(snapshot());};
  function detach(){
    if(!attachment)return;
    attachment.detach();
    disposeObject(attachment.model);
    attachment=null;
  }
  async function select(value){
    if(disposed)return false;
    const next=normalizeShield(value);
    const sameShield=next.leftHandShield===settings.leftHandShield;
    settings=next;
    error='';
    if(sameShield&&attachment&&!loading){
      attachment.update(settings);
      notify();
      return true;
    }
    const version=++request;
    detach();
    loading=false;
    const shield=studioShield(settings.leftHandShield);
    if(!shield){notify();return true;}
    const hand=findLeftHand(model);
    if(!hand){
      error='This model has no supported left-hand bone for the shield.';
      notify();
      return false;
    }
    loading=true;
    notify();
    let asset;
    try{
      asset=await loadAsset(shield);
      if(disposed||request!==version){
        disposeObject(asset);
        return false;
      }
      attachment=createShieldAttachment(THREE,hand,asset,settings);
      loading=false;
      notify();
      return true;
    }catch(cause){
      if(asset)disposeObject(asset);
      if(disposed||request!==version)return false;
      loading=false;
      error=`The shield could not be loaded. ${cause?.message||cause}`;
      notify();
      return false;
    }
  }
  function setModel(next,value={}){
    ++request;
    detach();
    model=next;
    settings=normalizeShield();
    loading=false;
    error='';
    return select(value);
  }
  function dispose(){
    disposed=true;
    ++request;
    detach();
    model=null;
    loading=false;
  }
  return {snapshot,select,setModel,dispose};
}

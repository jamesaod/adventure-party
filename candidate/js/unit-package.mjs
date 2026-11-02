/**
 * Versioned, data-only Unit Package format.
 * Definitions reference shared model/animation/equipment assets by ID.
 * Combat instances are separately created and are never saved as definitions.
 */
export const UNIT_PACKAGE_SCHEMA='adventure-party.unit-package';
export const UNIT_PACKAGE_VERSION=1;
export const UNIT_SOCKETS=Object.freeze([
  'right-hand-grip','left-hand-grip','shield-forearm','back-weapon','hip-weapon','head-attachment'
]);
const idPattern=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validId=(id,label)=>{if(typeof id!=='string'||id.length>100||!idPattern.test(id))throw new Error('Invalid '+label+' ID');return id;};
const vec=(v,label)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw new Error('Invalid '+label+' vector');return [...v];};
const clone=v=>structuredClone(v);
export function defineModelAttachmentProfile(value){
  if(!object(value))throw new Error('Attachment profile must be an object');
  const modelId=validId(value.modelId,'model');
  const sockets={};
  for(const [name,socket] of Object.entries(value.sockets||{})){
    if(!UNIT_SOCKETS.includes(name))throw new Error('Unknown attachment socket: '+name);
    if(!object(socket))throw new Error('Invalid socket: '+name);
    sockets[name]={
      bone:typeof socket.bone==='string'?socket.bone:null,
      position:vec(socket.position||[0,0,0],name+' position'),
      rotation:vec(socket.rotation||[0,0,0],name+' rotation'),
      scale:Number.isFinite(socket.scale)&&socket.scale>0?socket.scale:1
    };
  }
  return {modelId,sockets};
}
export function validateUnitPackage(value){
  if(!object(value)||value.schema!==UNIT_PACKAGE_SCHEMA||value.version!==UNIT_PACKAGE_VERSION)
    throw new Error('Unsupported Unit Package schema');
  validId(value.id,'unit');
  if(typeof value.name!=='string'||!value.name.trim())throw new Error('Unit display name is required');
  validId(value.modelId,'model');
  if(!object(value.character)||!object(value.character.rules))
    throw new Error('Unit must include character and rules metadata');
  if(value.character.level!==undefined&&(!Number.isInteger(value.character.level)||value.character.level<1||value.character.level>100))
    throw new Error('Invalid unit level');
  if(!Array.isArray(value.actionProfiles)||!value.actionProfiles.every(id=>typeof id==='string'&&idPattern.test(id)))
    throw new Error('Action profile IDs must be an array');
  if(new Set(value.actionProfiles).size!==value.actionProfiles.length)
    throw new Error('Duplicate action profile');
  if(!Array.isArray(value.equipment))throw new Error('Equipment must be an array');
  for(const item of value.equipment)validId(item?.itemId,'equipment item');
  if(value.attachments){
    const profile=defineModelAttachmentProfile(value.attachments);
    if(profile.modelId!==value.modelId)throw new Error('Attachment model mismatch');
  }
  if(value.references!==undefined&&!object(value.references))throw new Error('Invalid asset references');
  return value;
}
export function createUnitPackage({id,name,modelId,character={},actionProfiles=[],equipment=[],
  attachments=null,references={},mob={}}){
  const pkg={schema:UNIT_PACKAGE_SCHEMA,version:UNIT_PACKAGE_VERSION,id,name,modelId,
    character:{classId:character.classId??null,level:character.level??1,
      abilities:clone(character.abilities||{}),rules:clone(character.rules||{})},
    actionProfiles:[...actionProfiles],equipment:clone(equipment),
    attachments:attachments?defineModelAttachmentProfile(attachments):null,
    references:clone(references),mob:clone(mob)};
  return validateUnitPackage(pkg);
}
export function registerUnitDefinition(catalog,unit){
  validateUnitPackage(unit);
  if(!(catalog instanceof Map))throw new Error('Catalog must be a Map');
  if(catalog.has(unit.id))throw new Error('Duplicate unit definition ID: '+unit.id);
  catalog.set(unit.id,clone(unit));return catalog.get(unit.id);
}
export function instantiateUnit(definition,instanceId,overrides={}){
  validateUnitPackage(definition);
  if(typeof instanceId!=='string'||!instanceId.trim())throw new Error('Instance ID is required');
  return {instanceId,definitionId:definition.id,
    modelId:definition.modelId,character:clone(definition.character),
    actionProfiles:[...definition.actionProfiles],equipment:clone(definition.equipment),
    state:{hp:null,conditions:[],position:null,...clone(overrides)}};
}

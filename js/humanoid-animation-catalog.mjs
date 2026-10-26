export const HUMANOID_ANIMATION_CATALOG_VERSION=1;

export const HUMANOID_ANIMATION_GROUPS=Object.freeze({
  weapon:Object.freeze([
    'one-handed-swing',
    'one-handed-thrust',
    'one-handed-shield',
    'dual-wield',
    'two-handed-swing',
    'two-handed-thrust',
    'polearm',
    'staff',
    'wizard-staff-grip',
    'bow',
    'unarmed'
  ]),
  casting:Object.freeze([
    'arcane-cast',
    'divine-cast',
    'innate-cast'
  ]),
  condition:Object.freeze([
    'prone',
    'sleep',
    'held',
    'stunned',
    'dead'
  ])
});

export const HUMANOID_ANIMATION_IDS=Object.freeze(
  Object.values(HUMANOID_ANIMATION_GROUPS).flat()
);

export const HUMANOID_POSE_AFFECTING_CONDITION_IDS=Object.freeze([
  'prone','sleep','unconscious','held','stunned'
]);

const CONDITION_ALIASES=Object.freeze({
  unconscious:'prone',
  asleep:'sleep',
  sleeping:'sleep',
  paralyzed:'held',
  paralysed:'held',
  paralysis:'held',
  knockeddown:'prone',
  'knocked-down':'prone'
});

const PROFILE_ALIASES=Object.freeze({
  'one-handed-swing-v1':'one-handed-swing'
});

function freezeDeep(value){
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function pose(animation,sourceId=animation,timeSeconds=0){
  return freezeDeep({animation:String(animation||''),sourceId:String(sourceId||animation||''),timeSeconds:Number(timeSeconds)||0,gripCorrection:null});
}

function entry({
  id,category,label,fallbackId=null,implemented=false,poses={},
  handedness=null,attackStyle=null,source='semantic',sourceCandidates=[]
}){
  return freezeDeep({
    id,version:HUMANOID_ANIMATION_CATALOG_VERSION,category,label,
    fallbackId,implemented,handedness,attackStyle,source,
    sourceCandidates:[...sourceCandidates],poses:{...poses}
  });
}

const ONE_HANDED_SWING_POSES=freezeDeep({
  ready:pose('UAL2_Sword_Ready','UAL2_Sword_Ready',0),
  attack:pose('UAL2_Sword_Regular_A','UAL2_Sword_Regular_A',0.30),
  prone:pose('fall','fall',1.20)
});

export const HUMANOID_ANIMATION_CATALOG=freezeDeep({
  'one-handed-swing':entry({
    id:'one-handed-swing',category:'weapon',label:'One-handed swinging weapon',
    implemented:true,handedness:'one-handed',attackStyle:'swing',
    source:'Quaternius Universal Animation Library 2',
    poses:ONE_HANDED_SWING_POSES
  }),
  'one-handed-thrust':entry({
    id:'one-handed-thrust',category:'weapon',label:'One-handed thrusting weapon',
    fallbackId:'one-handed-swing',handedness:'one-handed',attackStyle:'thrust',
    sourceCandidates:['LAB_Sword_Stab']
  }),
  'one-handed-shield':entry({
    id:'one-handed-shield',category:'weapon',label:'One-handed weapon with shield',
    fallbackId:'one-handed-swing',handedness:'one-handed',attackStyle:'weapon-and-shield',
    sourceCandidates:['UAL2 sword + shield/melee family']
  }),
  'dual-wield':entry({
    id:'dual-wield',category:'weapon',label:'Dual Weapons — one weapon in each hand',
    fallbackId:'one-handed-swing',handedness:'dual',attackStyle:'swing',
    sourceCandidates:['Reuse one-handed swing ready / windup / attack while dedicated animations remain optional']
  }),
  'two-handed-swing':entry({
    id:'two-handed-swing',category:'weapon',label:'Two-handed swinging weapon',
    fallbackId:'one-handed-swing',handedness:'two-handed',attackStyle:'swing',
    sourceCandidates:['UAL2 heavy/regular armed combo family — Studio selection pending']
  }),
  'two-handed-thrust':entry({
    id:'two-handed-thrust',category:'weapon',label:'Two-handed thrusting weapon',
    fallbackId:'one-handed-thrust',handedness:'two-handed',attackStyle:'thrust',
    sourceCandidates:['UAL/UAL2 thrust candidate — Studio selection pending']
  }),
  polearm:entry({
    id:'polearm',category:'weapon',label:'Polearm',
    fallbackId:'two-handed-thrust',handedness:'two-handed',attackStyle:'polearm',
    sourceCandidates:['LAB_Spear_Guard','LAB_Spear_Thrust']
  }),
  staff:entry({
    id:'staff',category:'weapon',label:'Staff',
    fallbackId:'two-handed-swing',handedness:'two-handed',attackStyle:'staff',
    sourceCandidates:['LAB_Staff_Hold']
  }),
  'wizard-staff-grip':entry({
    id:'wizard-staff-grip',category:'weapon',label:'Wizard Staff Grip',
    fallbackId:'one-handed-swing',handedness:'one-handed',attackStyle:'staff',
    sourceCandidates:['Sword And Shield Idle']
  }),
  bow:entry({
    id:'bow',category:'weapon',label:'Bow',
    fallbackId:'unarmed',handedness:'two-handed',attackStyle:'ranged'
  }),
  unarmed:entry({
    id:'unarmed',category:'weapon',label:'Unarmed',
    fallbackId:'one-handed-swing',handedness:'none',attackStyle:'unarmed'
  }),
  'arcane-cast':entry({
    id:'arcane-cast',category:'casting',label:'Arcane spellcasting',
    fallbackId:'unarmed',sourceCandidates:['Spell_* arcane family']
  }),
  'divine-cast':entry({
    id:'divine-cast',category:'casting',label:'Divine spellcasting',
    fallbackId:'arcane-cast',sourceCandidates:['Spell_* divine/prayer family']
  }),
  'innate-cast':entry({
    id:'innate-cast',category:'casting',label:'Innate / special ability',
    fallbackId:'arcane-cast',sourceCandidates:['Spell_* / special ability family']
  }),
  prone:entry({
    id:'prone',category:'condition',label:'Prone',
    implemented:true,poses:{state:pose('fall','fall',1.20)},source:'existing humanoid fall pose'
  }),
  sleep:entry({
    id:'sleep',category:'condition',label:'Sleeping',
    fallbackId:'prone'
  }),
  held:entry({
    id:'held',category:'condition',label:'Held / paralyzed',
    fallbackId:'unarmed'
  }),
  stunned:entry({
    id:'stunned',category:'condition',label:'Stunned',
    fallbackId:'unarmed'
  }),
  dead:entry({
    id:'dead',category:'condition',label:'Dead / corpse',
    fallbackId:'prone'
  })
});

export function canonicalHumanoidAnimationId(id){
  const key=String(id||'').trim();
  const canonical=PROFILE_ALIASES[key]||key;
  return HUMANOID_ANIMATION_CATALOG[canonical]?canonical:'unarmed';
}

export function resolveHumanoidAnimationProfile(id){
  const semanticId=canonicalHumanoidAnimationId(id);
  const semantic=HUMANOID_ANIMATION_CATALOG[semanticId];
  let resolved=semantic,guard=0;
  while(resolved&&!Object.keys(resolved.poses||{}).length&&resolved.fallbackId&&guard++<16){
    resolved=HUMANOID_ANIMATION_CATALOG[canonicalHumanoidAnimationId(resolved.fallbackId)];
  }
  if(!resolved)resolved=HUMANOID_ANIMATION_CATALOG['one-handed-swing'];
  return freezeDeep({
    semanticId,
    resolvedId:resolved.id,
    usedFallback:semanticId!==resolved.id,
    semantic,
    resolved
  });
}

export function poseProfileForHumanoid(id){
  const result=resolveHumanoidAnimationProfile(id);
  return freezeDeep({
    id:`${result.semanticId}-v${HUMANOID_ANIMATION_CATALOG_VERSION}`,
    version:HUMANOID_ANIMATION_CATALOG_VERSION,
    semanticId:result.semanticId,
    resolvedId:result.resolvedId,
    label:result.semantic.label,
    category:result.semantic.category,
    handedness:result.semantic.handedness,
    attackStyle:result.semantic.attackStyle,
    fallbackUsed:result.usedFallback,
    poses:structuredClone(result.resolved.poses)
  });
}

/* Compatibility export while older Studio/package code migrates to semantic IDs. */
export const WEAPON_POSE_PROFILES=Object.freeze({
  'one-handed-swing-v1':poseProfileForHumanoid('one-handed-swing')
});

function normalizedActionType(action){
  if(typeof action==='string')return action.toLowerCase();
  return String(action?.type||action?.kind||action?.action||'').toLowerCase();
}

function effectIds(unit,extra=[]){
  const ids=new Set();
  for(const list of [unit?.buffs,unit?.debuffs,extra]){
    for(const effect of Array.isArray(list)?list:[]){
      const raw=typeof effect==='string'?effect:effect?.id;
      if(raw)ids.add(String(raw).toLowerCase());
    }
  }
  return ids;
}

function conditionSemanticId(unit,conditions=[]){
  if(unit?.alive===false||(Number.isFinite(unit?.hp)&&unit.hp<=0))return'dead';
  const ids=effectIds(unit,conditions);
  for(const wanted of ['dead','sleep','held','stunned','prone']){
    if(ids.has(wanted))return wanted;
    for(const [alias,canonical] of Object.entries(CONDITION_ALIASES)){
      if(canonical===wanted&&ids.has(alias))return wanted;
    }
  }
  return null;
}

function equippedItems(unit){
  return (Array.isArray(unit?.inventory)?unit.inventory:[]).filter(item=>item?.equipped);
}

function equipmentSemanticId(unit,explicitId=null){
  const items=equippedItems(unit);
  const weapon=items.find(item=>item?.slot==='weapon')||null;
  const shield=items.find(item=>item?.slot==='shield')||null;
  const offhand=items.find(item=>['offhand-weapon','off-hand-weapon','left-hand-weapon','offhand'].includes(item?.slot))||null;
  let id=explicitId||
    weapon?.animationProfileId||
    weapon?.poseProfileId||
    weapon?.appearance?.animationProfileId||
    weapon?.appearance?.poseProfileId||
    'unarmed';
  id=canonicalHumanoidAnimationId(id);
  if(offhand && weapon && !shield)id='dual-wield';
  if(shield&&['one-handed-swing','one-handed-thrust'].includes(id))id='one-handed-shield';
  return id;
}

function castingSemanticId(action){
  const explicit=action?.animationProfileId||action?.animationId;
  if(explicit&&HUMANOID_ANIMATION_CATALOG[canonicalHumanoidAnimationId(explicit)]?.category==='casting'){
    return canonicalHumanoidAnimationId(explicit);
  }
  const text=`${action?.castingType||''} ${action?.spellGroup||''} ${action?.className||''} ${action?.source||''}`.toLowerCase();
  if(/divine|cleric|priest|prayer/.test(text))return'divine-cast';
  if(/innate|special|ability|monster/.test(text))return'innate-cast';
  return'arcane-cast';
}

export function resolveHumanoidAnimationState(unit,{
  action=null,conditions=[],equipmentAnimationId=null
}={}){
  const conditionId=conditionSemanticId(unit,conditions);
  if(conditionId){
    const profile=resolveHumanoidAnimationProfile(conditionId);
    return freezeDeep({
      semanticId:conditionId,resolvedId:profile.resolvedId,pose:'state',
      category:'condition',reason:`condition:${conditionId}`,conditionId
    });
  }

  const actionType=normalizedActionType(action);
  if(/cast|spell/.test(actionType)){
    const semanticId=castingSemanticId(action);
    const profile=resolveHumanoidAnimationProfile(semanticId);
    return freezeDeep({
      semanticId,resolvedId:profile.resolvedId,pose:'cast',
      category:'casting',reason:`action:${actionType||'cast'}`,conditionId:null
    });
  }
  if(/special|ability|power/.test(actionType)){
    const semanticId='innate-cast';
    const profile=resolveHumanoidAnimationProfile(semanticId);
    return freezeDeep({
      semanticId,resolvedId:profile.resolvedId,pose:'cast',
      category:'casting',reason:`action:${actionType}`,conditionId:null
    });
  }

  const semanticId=equipmentSemanticId(unit,equipmentAnimationId);
  const profile=resolveHumanoidAnimationProfile(semanticId);
  return freezeDeep({
    semanticId,resolvedId:profile.resolvedId,
    pose:/attack|melee|ranged|strike|shoot/.test(actionType)?'attack':'ready',
    category:'weapon',reason:actionType?`action:${actionType}`:'equipment-ready',
    conditionId:null
  });
}

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object'){
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashText(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
}

export function humanoidSpriteFamilySignature(unit,{
  action=null,conditions=[],equipmentAnimationId=null,
  modelId=null,modelHash=null,renderVersion=null
}={}){
  const state=resolveHumanoidAnimationState(unit,{action,conditions,equipmentAnimationId});
  const visibleEquipment=equippedItems(unit).map(item=>({
    slot:item.slot||null,
    catalogItemId:item.catalogItemId||item.id||null,
    appearanceId:item.appearanceId||item.appearance?.appearanceId||null,
    sizePercent:item.sizePercent??null,
    position:item.position??null,
    rotation:item.rotation??null
  })).sort((a,b)=>String(a.slot).localeCompare(String(b.slot))||String(a.appearanceId).localeCompare(String(b.appearanceId)));
  const payload={
    version:HUMANOID_ANIMATION_CATALOG_VERSION,
    mobType:unit?.type||null,
    heightInches:unit?.heightInches??null,
    modelId,modelHash,renderVersion,
    visibleEquipment,
    semanticId:state.semanticId,
    resolvedId:state.resolvedId,
    conditionId:state.conditionId
  };
  return `humanoid-sprite-family-v1-${hashText(canonical(payload))}`;
}

export function isHumanoidPoseAffectingCondition(id){
  const raw=String(id||'').toLowerCase();
  return HUMANOID_POSE_AFFECTING_CONDITION_IDS.includes(raw)||!!CONDITION_ALIASES[raw];
}

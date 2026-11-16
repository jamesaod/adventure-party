import {LOW_POLY_WEAPON_ASSETS as assets} from './low-poly-weapon-assets.mjs';
export const WEAPON_MODEL_REVISION=100;
// Unit-length +Y assets. Native lengths use the existing Studio calibration.
export function installLowPolyWeapons(catalog){
 const copy=id=>structuredClone(catalog[id]);
 function add(id,name,base,rules={}){const item=copy(base);item.id=id;item.name=name;item.rules={...item.rules,...rules};item.appearance={...item.appearance,appearanceId:id,studioId:id};catalog[id]=item;return item;}
 const plain=add('long-sword','Long Sword','flaming-sword-5');
 for(const key of ['lightSource','magicHitBonus','magicDamageBonus','bonusDamageExpression','bonusDamageType'])delete plain.rules[key];
 add('hand-axe','Hand Axe','battle-axe',{catalogWeaponId:'axe-hand',baseName:'Hand Axe',handsRequired:1,damageSM:'1d6',damageL:'1d4',encumbrance:5,cost:'1 gp'});
 plain.rules.magicHitBonus=0;plain.rules.magicDamageBonus=0;
 const custom=(id,name,base,damageSM,damageL,cost,weight,size,speedFactor)=>add(id,name,base,{catalogWeaponId:null,baseName:name,handsRequired:2,damageSM,damageL,cost,encumbrance:weight,size,speedFactor});
 custom('two-handed-battle-axe','Two-Handed Battle Axe','battle-axe','1d10','2d8','10 gp',10,'M',9);
 custom('great-mace','Great Mace','mace','1d8+1','2d4','20 gp',20,'M',10);
 custom('maul','Maul','mace','2d4','1d10','5 gp',10,'L',9);
 add('two-handed-falchion','Two-Handed Falchion','two-handed-sword',{handsRequired:2});
 for(const id of ['warhammer','warhammer-2'])add(id,id==='warhammer'?'Warhammer — Type 1':'Warhammer — Type 2','mace',{catalogWeaponId:'hammer-war-light',baseName:'Warhammer',handsRequired:1,damageSM:'1d4+1',damageL:'1d4',encumbrance:5,cost:'1 gp'});
 add('spear-2','Spear — Type 2','spear');
 const staff=add('staff','Staff','wooden-staff',{handsRequired:1});
 staff.appearance.poseProfileId='wizard-staff-grip';
 catalog['wooden-staff'].name='Quarterstaff';
 add('longbow','Longbow','recurve-bow',{baseName:'Longbow',catalogMissileWeaponId:'bow-long'});
 add('composite-longbow','Composite Longbow','recurve-bow',{baseName:'Composite Longbow',catalogMissileWeaponId:'bow-composite-long'});
 const rows=[
 ['flaming-sword-5','sword_3',.55,.12],['long-sword','sword_3',.55,.12],
 ['hand-axe','axe_3',.40,.22],['two-handed-battle-axe','axe_5',.80,.18],
 ['dagger','dagger_2',.205,.19],['warhammer','hammer_1',.40,.18],['warhammer-2','hammer_3',.40,.18],['maul','hammer_5',.80,.18],
 ['two-handed-falchion','longsword_4',.78,.16],['two-handed-sword','longsword_5',.78,.16],
 ['morning-star','mace_1',.385417,.18],['mace','mace_2',.359722,.18],['great-mace','mace_4',.80,.18],
 ['spear','spear_4',1.18,.35],['spear-2','spear_5',1.18,.35],
 ['wooden-staff','staff_1',.925,.42],['staff','staff_2',.925,.42],
 ['broadsword','sword_4',.488194,.13],['scimitar','sword_5',.436806,.14],
 ['longbow','bow_1',.90,.5],['composite-longbow','bow_2',.90,.5],['crossbow','bow_cross',.42,.25]
 ];
 for(const [id,mesh,nativeScale,gripY] of rows){
  const item=catalog[id],old=item.appearance,a=assets[mesh];
  const hands=item.rules.handsRequired??old.handsRequired??1;
  item.rules.handsRequired=hands;
  const bow=id==='longbow'||id==='composite-longbow';
  const pose=bow?'bow':id==='crossbow'?'direct-fire':hands===2?'two-handed-swing':old.poseProfileId||'one-handed-swing';
  item.physical={calibratedLengthInches:Math.round(nativeScale*77.8*10)/10,status:'Experimental low-poly model; grip remains adjustable in Equipment Fit.'};
  item.appearance={appearanceId:id,studioId:old.studioId,visualClass:bow?'bow':old.visualClass||'sword',representation:'source-gltf-v1',asset:a.asset,runtimeAsset:a,attachment:bow?'left-hand':'right-hand',handsRequired:hands,poseProfileId:pose,primaryAxis:[0,1,0],grip:[0,gripY,0],nativeScale,defaultSizePercent:100,position:[.015,.05,.005],rotationDegrees:id==='crossbow'?[180,0,0]:[-90,0,0],presetRevision:WEAPON_MODEL_REVISION,
   ...(hands===2&&!bow&&id!=='crossbow'?{secondaryGrip:[0,Math.max(.04,gripY-.12),0]}:{}),
   ...(bow?{drawnAsset:assets[mesh+'_1'].asset,attachmentHand:'left'}:{}),
   ...(id==='flaming-sword-5'||id==='long-sword'?{flameSpan:{base:[0,.29,0],tip:[0,.98,0]}}:{})};
 }
 catalog['arrow']={id:'arrow',name:'Arrow',category:'item',slot:'inventory',rules:{catalogWeaponId:'arrows',damageSM:'1d6',damageL:'1d6'},appearance:null,modelAsset:assets.arrow_1.asset};
 catalog['empty-quiver']={id:'empty-quiver',name:'Empty Quiver',category:'item',slot:'inventory',rules:{},appearance:null,modelAsset:assets.quiver.asset};
 return catalog;
}
export function catalogWeaponPreset(item){
 const a=item.appearance;
 return {...a,id:a.studioId,label:item.name,file:a.asset,assetSha256:a.runtimeAsset?.sha256,rotation:a.rotationDegrees,calibratedLengthInches:item.physical?.calibratedLengthInches};
}

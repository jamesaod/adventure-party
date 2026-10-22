export const ITEM_CATALOG_VERSION=1;

function freezeRecord(value){
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezeRecord(child);
    Object.freeze(value);
  }
  return value;
}

export const ITEM_CATALOG=freezeRecord({
  'flaming-sword-5':{
    id:'flaming-sword-5',
    name:'Flaming Sword +5',
    category:'weapon',
    slot:'weapon',
    rules:{
      catalogWeaponId:'sword-long',
      baseName:'Long Sword',
      damageSM:'1d8',
      damageL:'1d12',
      encumbrance:7,
      cost:'15 gp',
      magicHitBonus:5,
      magicDamageBonus:5,
      bonusDamageExpression:'1d6',
      bonusDamageType:'fire'
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:null,
      status:'Physical dimensions not yet authored.'
    },
    appearance:{
      appearanceId:'flaming-sword-5',
      studioId:'medieval-sword',
      asset:'assets/models/weapons/swords/medieval-sword.glb',
      attachment:'right-hand',
      poseProfileId:'one-handed-swing-v1'
    }
  },
  'battle-axe':{
    id:'battle-axe',
    name:'Battle Axe',
    category:'weapon',
    slot:'weapon',
    rules:{
      catalogWeaponId:'axe-battle',
      baseName:'Axe, battle',
      damageSM:'1d8',
      damageL:'1d8',
      encumbrance:7,
      cost:'5 gp'
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:null,
      status:'Physical dimensions not yet authored.'
    },
    appearance:{
      appearanceId:'battle-axe',
      studioId:'battle-axe',
      asset:'assets/models/weapons/battle-axes/battle-axe.glb',
      attachment:'right-hand',
      poseProfileId:'one-handed-swing-v1'
    }
  },
  'chain-mail':{
    id:'chain-mail',
    name:'Chain Mail',
    category:'armor',
    slot:'armor',
    rules:{
      catalogArmorId:'chain',
      baseArmorClass:5,
      acModifier:-5,
      encumbrance:30,
      maxMoveFt:90,
      cost:'75 gp'
    },
    physical:{
      authoredSize:null,
      status:'Armor dimensions are not yet modeled.'
    },
    appearance:null
  },
  'round-wooden-shield':{
    id:'round-wooden-shield',
    name:'Round Wooden Shield',
    category:'shield',
    slot:'shield',
    rules:{
      catalogArmorId:'shield-medium',
      acBonus:1,
      encumbrance:8,
      cost:'12 gp',
      rearProtection:false,
      maxProtectedAttacksPerRound:2
    },
    physical:{
      authoredDiameterInches:null,
      calibratedDiameterInches:35,
      calibratedThicknessInches:8.72,
      sourceModelBounds:{
        min:[-0.4998169541358948,0,-0.12459565699100494],
        max:[0.4998169541358948,1,0.12459565699100494]
      },
      sourceModelExtent:[0.9996339082717896,1,0.2491913139820099],
      status:'Render-calibrated dimensions relative to Dungeon Crawler Carl at 76 inches; real-world dimensions are not yet author-confirmed.'
    },
    appearance:{
      appearanceId:'round-wooden-shield',
      studioId:'round-wooden-shield',
      visualClass:'round-shield',
      representation:'procedural-round-shield-textured-v1',
      attachment:'left-hand',
      nativeScale:0.45,
      modelOrigin:[0,0,0],
      source:{
        originalFilename:'round+wooden+shield+3d+model.glb',
        originalBytes:781832,
        originalSha256:'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928',
        vertices:5648,
        triangles:8478,
        textureResolution:1024
      },
      texturePack:{
        resolution:256,
        baseColor:{
          path:'assets/models/shields/round-wooden-shield-textures/basecolor.jpg.b64',
          bytes:17079,
          sha256:'101d884733e850625da37d3d629b5a8cd070785c2707069c081d1209de5f1fbd'
        },
        normal:{
          path:'assets/models/shields/round-wooden-shield-textures/normal.jpg.b64',
          bytes:5528,
          sha256:'5a656d1e404a2b02fe2caa6c032daa7d3c1f711c1c81f3cffbe73403efa36220'
        },
        roughnessMetallic:{
          path:'assets/models/shields/round-wooden-shield-textures/roughness-metallic.jpg.b64',
          bytes:14372,
          sha256:'e9c04df10678786d7dc8eb39f517059a78f7a3a76e1059e710a0533593db34f8'
        },
        derivation:'Texture maps are downsampled from the uploaded GLB; runtime geometry preserves the uploaded model proportions for reliable web loading.'
      }
    }
  }
});

export function itemCatalogEntry(id){
  return id?ITEM_CATALOG[id]||null:null;
}

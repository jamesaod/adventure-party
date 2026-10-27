export const ITEM_CATALOG_VERSION=3;

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
      poseProfileId:'one-handed-swing'
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
      poseProfileId:'one-handed-swing'
    }
  },
  'two-handed-sword':{
    id:'two-handed-sword',
    name:'Two-Handed Sword',
    category:'weapon',
    slot:'weapon',
    rules:{
      catalogWeaponId:'sword-two-handed',
      baseName:'Two-Handed Sword'
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:60.6,
      sourceModelBounds:{
        min:[-0.1240234524011612,0,-0.029155734926462173],
        max:[0.1240234524011612,1,0.029155734926462173]
      },
      status:'Studio-calibrated test length relative to Dungeon Crawler Carl at 76 inches; gameplay dimensions/rules are not yet authored.'
    },
    appearance:{
      appearanceId:'two-handed-sword',
      studioId:'medieval-two-handed-sword',
      visualClass:'two-handed-sword',
      representation:'source-gltf-v1',
      asset:'assets/models/weapons/two-handed-swords/medieval-two-handed-sword.glb',
      materialOverrides:{metalness:0.15,colorGain:1.4},
      attachment:'right-hand',
      secondaryAttachment:'left-hand',
      handsRequired:2,
      poseProfileId:'two-handed-swing',
      primaryAxis:[0,-1,0],
      grip:[0,0.81,0],
      secondaryGrip:[0,0.95,0],
      nativeScale:0.78,
      defaultSizePercent:100,
      position:[0.015,0.05,0.005],
      rotationDegrees:[90,0,0],
      source:{
        originalFilename:'medieval+sword+3d+model (1).glb',
        originalBytes:646456,
        originalSha256:'85408b9b17fa38a72816d57ac55e63e6409862b5d5a305beb6cf5eee045c948a',
        vertices:6623,
        triangles:8333,
        textureResolution:1024
      }
    }
  },
  spear:{
    id:'spear', name:'Spear', category:'weapon', slot:'weapon',
    rules:{catalogWeaponId:'spear',baseName:'Spear',damageType:'piercing',
      damageSM:'1d6',damageL:'1d8',encumbrance:5,cost:'1 gp',handsRequired:2,setAgainstCharge:true},
    physical:{authoredLengthInches:null,calibratedLengthInches:91.7,
      status:'Provisional Studio scale relative to Carl at 76 inches; tune grip for each model.'},
    appearance:{
      appearanceId:'spear',studioId:'spear',visualClass:'spear',
      representation:'optimized-gltf-v1',asset:'assets/models/weapons/spears/spear.glb',
      attachment:'right-hand',secondaryAttachment:'left-hand',handsRequired:2,
      poseProfileId:'two-handed-thrust',primaryAxis:[0,1,0],
      grip:[0,0.35,0],secondaryGrip:[0,0.55,0],nativeScale:1.18,
      defaultSizePercent:100,position:[0.015,0.05,0.005],rotationDegrees:[-90,0,0],
      source:{originalFilename:'spear.zip',sourceFbx:'source/Kopie_tip_1_NEW.fbx',
        sourceFbxSha256:'f27c1a6aa0d5f3644c150886683b54b6d751deda68902f000d9ccecf61685c35',triangles:642},
      runtimeAsset:{bytes:129616,sha256:'9852707d7ce895ed860794a24eaa9cabfb0eb06ffa5b77f2d125e6e5c0c5ca21',triangles:512,textureResolution:512,
        derivation:'Blender 5.1: 0.8 decimation, unit-length +Y, 512px PBR JPEG maps at quality 90.'}
    }
  },
  'recurve-bow':{
    id:'recurve-bow',name:'Recurve Bow',category:'weapon',slot:'weapon',
    rules:{baseName:'Recurve Bow',handsRequired:2,damageType:'piercing',attackStyle:'ranged'},
    physical:{authoredLengthInches:null,calibratedLengthInches:59,
      status:'Provisional 59-inch Studio bow; adjust size and grip for the selected rig.'},
    appearance:{
      appearanceId:'recurve-bow',studioId:'recurve-bow',visualClass:'bow',
      representation:'optimized-gltf-v1',asset:'assets/models/weapons/bows/recurve-bow.glb',
      attachment:'left-hand',handsRequired:2,poseProfileId:'bow',primaryAxis:[0,1,0],
      materialOverrides:{transmission:0},
      grip:[-2.91,2.17,0],nativeScale:0.16,defaultSizePercent:100,
      position:[0,0.05,0],rotationDegrees:[173,12,-97],
      source:{originalFilename:'recurve-bow.zip',sourceGlbSha256:'5869d8baf20cf1860b0418cd403a5d7d18346eb6a00f898f0122e60e37abefac'},
      runtimeAsset:{bytes:1237464,sha256:'3314489c45b1b46ad4dc83724d2027da4e315e2119c36d5242b3192a94d964a9',triangles:3717,textureResolution:512}
    }
  },
  sling:{
    "id": "sling",
    "name": "Sling",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "sling",
      "baseName": "Sling",
      "handsRequired": 1,
      "damageType": "bludgeoning",
      "attackStyle": "ranged"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 26.5,
      "status": "Provisional hanging span; adjustable Studio scale and grip."
    },
    "appearance": {
      "appearanceId": "sling",
      "studioId": "sling",
      "visualClass": "sling",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/slings/sling.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "sling",
      "primaryAxis": [
        0,
        -1,
        0
      ],
      "grip": [
        0,
        0.889858,
        0
      ],
      "nativeScale": 0.34,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        91.25093,
        79.617197,
        -125.014997
      ],
      "previewPose": {
        "modelId": "dungeon-crawler-carl-v3",
        "animationId": "uploaded:goalie-throw:0",
        "timeSeconds": 1.5666666666666667
      },
      "source": {
        "url": "https://grab3d.com/models/weapons/sling/",
        "sha256": "b71ad36709993a7a5a5787ad6464366862a5ddff3edcf9d516da526a65ffcaa6",
        "license": "CC0-1.0"
      },
      "runtimeAsset": {
        "bytes": 557844,
        "sha256": "ed1f11ef26083a0b998f6bbd71dbc6b47926215f476f026d0baf8e1bd753c861",
        "triangles": 9512,
        "textureResolution": 512
      }
    }
  },
  crossbow:{
    id:'crossbow',name:'Crossbow',category:'weapon',slot:'weapon',
    rules:{baseName:'Crossbow',handsRequired:2,damageType:'piercing',attackStyle:'ranged'},
    physical:{authoredLengthInches:null,calibratedLengthInches:32.6,
      status:'Provisional 32.6-inch Studio crossbow; adjust size and grip for the selected rig.'},
    appearance:{
      appearanceId:'crossbow',studioId:'crossbow',visualClass:'crossbow',
      representation:'optimized-gltf-v1',asset:'assets/models/weapons/crossbows/crossbow.glb',
      attachment:'right-hand',handsRequired:2,poseProfileId:'direct-fire',primaryAxis:[0,0,1],
      grip:[0,-0.015,0.30],nativeScale:0.42,defaultSizePercent:100,
      position:[0.015,0.05,0.005],rotationDegrees:[-87,29,0],
      source:{originalFilename:'crossbow.zip',sourceFbxSha256:'9df0fe0254720f5dfb227f2a8c5f0ca8fec24a0fa966d06368feba086388b4b0'},
      runtimeAsset:{bytes:1030700,sha256:'505c542372cee565a1a267476ec44d63b5ada0dd956d4b393c03c16fa847c6c8',triangles:4678,textureResolution:512}
    }
  },
  "wooden-staff":{
    id:"wooden-staff",
    name:"Wooden Staff",
    category:"weapon",
    slot:"weapon",
    rules:{
      catalogWeaponId:"staff",
      baseName:"Wooden Staff",
      handsRequired:2,
      damageType:"bludgeoning"
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:72,
      status:"Provisional Studio length; scale and grip remain adjustable."
    },
    appearance:{
      appearanceId:"wooden-staff",
      studioId:"wooden-staff",
      visualClass:"staff",
      representation:"optimized-gltf-v1",
      asset:"assets/models/weapons/staves/wooden-staff.glb",
      attachment:"right-hand",
      handsRequired:2,
      poseProfileId:"two-handed-swing",
      primaryAxis:[0,1,0],
      grip:[0,0.42,0],
      nativeScale:0.925,
      defaultSizePercent:100,
      position:[0.015,0.05,0.005],
      rotationDegrees:[-90,0,0],
      source:{"originalFilename":"wooden+staff+3d+model.zip","sourceSha256":"5dffd2110df27b986f185b3f0456d0c18b3e0ca032c3aedb66db6e9c6112c345"},
      runtimeAsset:{"bytes":956992,"sha256":"511a254c763dd9c1569dd181f1c72fa1ba83ef3b92bfc2b4f46517e0f773e1ed","triangles":7664,"textureResolution":512},
      secondaryGrip:[0,0.62,0]
    }
  },
  "wizard-staff-grip":{
    id:"wizard-staff-grip",
    name:"Wizard Staff Grip",
    category:"weapon",
    slot:"weapon",
    rules:{
      catalogWeaponId:"staff",
      baseName:"Wizard Staff Grip",
      handsRequired:1,
      damageType:"bludgeoning"
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:72,
      status:"Provisional Studio length; scale and grip remain adjustable."
    },
    appearance:{
      appearanceId:"wizard-staff-grip",
      studioId:"wizard-staff-grip",
      visualClass:"wizard-staff",
      representation:"optimized-gltf-v1",
      asset:"assets/models/weapons/staves/wooden-staff.glb",
      attachment:"right-hand",
      handsRequired:1,
      poseProfileId:"wizard-staff-grip",
      primaryAxis:[0,1,0],
      grip:[0,0.55,0],
      nativeScale:0.925,
      defaultSizePercent:100,
      position:[0.015,0.05,0.005],
      rotationDegrees:[-69.201659,-33.008024,46.485403],
      source:{"originalFilename":"wooden+staff+3d+model.zip","sourceSha256":"5dffd2110df27b986f185b3f0456d0c18b3e0ca032c3aedb66db6e9c6112c345"},
      runtimeAsset:{"bytes":956992,"sha256":"511a254c763dd9c1569dd181f1c72fa1ba83ef3b92bfc2b4f46517e0f773e1ed","triangles":7664,"textureResolution":512}
    }
  },
  "short-sword":{
    id:"short-sword",
    name:"Short Sword",
    category:"weapon",
    slot:"weapon",
    rules:{
      catalogWeaponId:"sword-short",
      baseName:"Short Sword",
      handsRequired:1,
      damageType:"piercing"
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:30.3,
      status:"Provisional Studio length; scale and grip remain adjustable."
    },
    appearance:{
      appearanceId:"short-sword",
      studioId:"short-sword",
      visualClass:"sword",
      representation:"optimized-gltf-v1",
      asset:"assets/models/weapons/swords/short-sword.glb",
      attachment:"right-hand",
      handsRequired:1,
      poseProfileId:"one-handed-thrust",
      primaryAxis:[0,1,0],
      grip:[0,0.14,0],
      nativeScale:0.39,
      defaultSizePercent:100,
      position:[0.015,0.05,0.005],
      rotationDegrees:[-90,0,0],
      source:{"originalFilename":"splendid-short-sword.zip","sourceSha256":"6b39abf138611c8e78e3005b6d8fad2bc0e5fc3ec6a1d5e2cfda084e6d5308e1"},
      runtimeAsset:{"bytes":751792,"sha256":"0ee9dc416fe68ad516dc2ef99aa5b3c5b574a91718474171fcb19fb919f31261","triangles":500,"textureResolution":512}
    }
  },
  "dagger":{
    id:"dagger",
    name:"Dagger",
    category:"weapon",
    slot:"weapon",
    rules:{
      catalogWeaponId:"dagger",
      baseName:"Dagger",
      handsRequired:1,
      damageType:"piercing"
    },
    physical:{
      authoredLengthInches:null,
      calibratedLengthInches:15.9,
      status:"Provisional Studio length; scale and grip remain adjustable."
    },
    appearance:{
      appearanceId:"dagger",
      studioId:"dagger",
      visualClass:"dagger",
      representation:"optimized-gltf-v1",
      asset:"assets/models/weapons/daggers/medieval-dagger.glb",
      attachment:"right-hand",
      handsRequired:1,
      poseProfileId:"one-handed-thrust",
      primaryAxis:[0,1,0],
      grip:[0,0.18,0],
      nativeScale:0.205,
      defaultSizePercent:100,
      position:[0.015,0.05,0.005],
      rotationDegrees:[-90,0,0],
      source:{"originalFilename":"medieval_dagger_3d_model.zip","sourceSha256":"7a934c9eaee89b700a0349a69b71e8ef0e75f0587990df60a0bcb368fd3891ac"},
      runtimeAsset:{"bytes":674868,"sha256":"625b794a045968d3d1643bfdb3bb10c73eb51b582d5f0471f9a3b3661810ae56","triangles":960,"textureResolution":512}
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
      calibratedThicknessInches:6.13,
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
      representation:'source-gltf-v1',
      asset:'assets/models/shields/round-wooden-shield.glb',
      materialOverrides:{metalness:0.15,colorGain:1.4},
      attachment:'left-hand',
      nativeScale:0.45,
      modelOrigin:[0,0.5,0],
      source:{
        originalFilename:'round+wooden+shield+3d+model.glb',
        originalBytes:781832,
        originalSha256:'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928',
        vertices:5648,
        triangles:8478,
        textureResolution:1024
      },
      runtimeAsset:{
        bytes:781832,
        sha256:'4a0bad4a77b3e5a086576b00e8890ef5f0c2417ea423559ef7196acd8a488928',
        textureResolution:1024,
        vertices:5648,
        triangles:8478,
        derivation:'Exact user-uploaded GLB used directly as the runtime shield asset.'
      }
    }
  }
});

export function itemCatalogEntry(id){
  return id?ITEM_CATALOG[id]||null:null;
}

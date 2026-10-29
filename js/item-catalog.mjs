export const ITEM_CATALOG_VERSION=4;

function freezeRecord(value){
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezeRecord(child);
    Object.freeze(value);
  }
  return value;
}

export const ITEM_CATALOG=freezeRecord({
  'shield-orc':{
  "id": "shield-orc",
  "name": "Shield, Orc",
  "category": "shield",
  "slot": "shield",
  "rules": {
    "catalogArmorId": "shield-medium",
    "acBonus": 1,
    "encumbrance": 8,
    "cost": "12 gp",
    "rearProtection": false,
    "maxProtectedAttacksPerRound": 2
  },
  "physical": {
    "sourceModelBounds": {
      "min": [
        -0.5,
        0,
        0
      ],
      "max": [
        0.5,
        1,
        0.067735
      ]
    },
    "status": "Matches the existing round shield mount and render size; physical dimensions are not yet calibrated."
  },
  "appearance": {
    "appearanceId": "shield-orc",
    "studioId": "shield-orc",
    "visualClass": "round-shield",
    "representation": "source-gltf-v1",
    "asset": "assets/models/shields/shield-orc.glb",
    "attachment": "left-hand",
    "nativeScale": 0.45,
    "modelOrigin": [
      0,
      0.5,
      0
    ],
    "source": {
      "originalFilename": "SM_Wep_Shield_Set_54.fbx",
      "originalBytes": 72464,
      "originalSha256": "1a75d14b951298191a43e8b0dae8f3036702382d77ebca616cd6f8cfff1917ce"
    },
    "runtimeAsset": {
      "bytes": 91180,
      "sha256": "d3ea72f9591b911ebe953f0d751c7877c25eb89fffe6c41e70f6a2f3cc96d810",
      "textureResolution": 256,
      "triangles": 622,
      "derivation": "User FBX with red/black atlas crop, front UV remap, plain backing and edge, normalized to the shared shield frame."
    }
  }
},
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
      damageSM:'1d6',damageL:'1d8',encumbrance:5,cost:'1 gp',handsRequired:1,setAgainstCharge:true},
    physical:{authoredLengthInches:null,calibratedLengthInches:91.7,
      status:'Provisional Studio scale relative to Carl at 76 inches; tune grip for each model.'},
    appearance:{
      appearanceId:'spear',studioId:'spear',visualClass:'spear',
      representation:'optimized-gltf-v1',asset:'assets/models/weapons/spears/spear.glb',
      attachment:'right-hand',handsRequired:1,
      poseProfileId:'one-handed-thrust',primaryAxis:[0,1,0],
      grip:[0,0.35,0],nativeScale:1.18,
      defaultSizePercent:100,position:[0.015,0.05,0.005],rotationDegrees:[-90,0,0],
      source:{originalFilename:'spear.zip',sourceFbx:'source/Kopie_tip_1_NEW.fbx',
        sourceFbxSha256:'f27c1a6aa0d5f3644c150886683b54b6d751deda68902f000d9ccecf61685c35',triangles:642},
      runtimeAsset:{bytes:129616,sha256:'9852707d7ce895ed860794a24eaa9cabfb0eb06ffa5b77f2d125e6e5c0c5ca21',triangles:512,textureResolution:512,
        derivation:'Blender 5.1: 0.8 decimation, unit-length +Y, 512px PBR JPEG maps at quality 90.'}
    }
  },
  'recurve-bow':{
    id:'recurve-bow',name:'Bow',category:'weapon',slot:'weapon',
    rules:{baseName:'Bow',catalogMissileWeaponId:'bow-short',handsRequired:2,damageType:'piercing',attackStyle:'ranged'},
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
    name:"Wooden Staff 1",
    category:"weapon",
    slot:"weapon",
    rules:{
      catalogWeaponId:"staff",
      baseName:"Wooden Staff 1",
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
  "trident": {
    "id": "trident",
    "name": "Trident",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "trident",
      "baseName": "Trident",
      "handsRequired": 2,
      "damageType": "piercing"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 72,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "trident",
      "studioId": "trident",
      "visualClass": "spear",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/trident.glb",
      "attachment": "right-hand",
      "handsRequired": 2,
      "poseProfileId": "two-handed-thrust",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.35,
        0
      ],
      "nativeScale": 0.925,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "mossy-golden-trident.zip",
        "sourceSha256": "d099bf080ea73bb69a53a21c1ec162856e3a55ecd3c49ed456ae5e8c1d7d76d9"
      },
      "runtimeAsset": {
        "bytes": 359968,
        "sha256": "d7d96c0fb57f5240cf14fb6613d637339e74e73439e997a1e4348320bb9249b5",
        "triangles": 1136,
        "textureResolution": 256
      },
      "secondaryGrip": [
        0,
        0.55,
        0
      ]
    }
  },
  "scimitar": {
    "id": "scimitar",
    "name": "Scimitar",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "sword-scimitar",
      "baseName": "Scimitar",
      "handsRequired": 1,
      "damageType": "slashing"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 34,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "scimitar",
      "studioId": "scimitar",
      "visualClass": "sword",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/scimitar.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.14,
        0
      ],
      "nativeScale": 0.436806,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "pirate-scimitar-sword.zip",
        "sourceSha256": "a80671d90ead5c3b2acb89ff073bc5948bba8c82bcec23ec933e1b92c3b9cf37"
      },
      "runtimeAsset": {
        "bytes": 215340,
        "sha256": "94ccd84a8a1c38fec5a68ce3a19c229dd44ecfbe1287d89d1aaa2017d7be1edc",
        "triangles": 787,
        "textureResolution": 256
      }
    }
  },
  "broadsword": {
    "id": "broadsword",
    "name": "Broadsword",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "sword-broad",
      "baseName": "Broadsword",
      "handsRequired": 1,
      "damageType": "slashing"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 38,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "broadsword",
      "studioId": "broadsword",
      "visualClass": "sword",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/broadsword.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.13,
        0
      ],
      "nativeScale": 0.488194,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "ps1-italian-broadsword.zip",
        "sourceSha256": "bdbaae90bdeb25b80425add997a2838157152bb5cd36c51db81601bb6bdbc866"
      },
      "runtimeAsset": {
        "bytes": 98580,
        "sha256": "7f2590c7b80a2506c93ea22f7299b2206adea1e3a942f7fec48afa46919a8f17",
        "triangles": 174,
        "textureResolution": 256
      }
    }
  },
  "lucerne-hammer": {
    "id": "lucerne-hammer",
    "name": "Lucerne Hammer",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "pole-arm",
      "baseName": "Lucerne Hammer",
      "handsRequired": 2,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 72,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "lucerne-hammer",
      "studioId": "lucerne-hammer",
      "visualClass": "staff",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/lucerne-hammer.glb",
      "attachment": "right-hand",
      "handsRequired": 2,
      "poseProfileId": "two-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.25,
        0
      ],
      "nativeScale": 0.925,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "medieval-war-hammer.zip",
        "sourceSha256": "cc2c8f42a710288846a58fa50fe17aad923de41586353380aa01c89141608119"
      },
      "runtimeAsset": {
        "bytes": 466808,
        "sha256": "c058d4d290cd93a3ba4314984824975820c6278eb6ed830109493a4bfe1aa55c",
        "triangles": 4498,
        "textureResolution": 256
      },
      "secondaryGrip": [
        0,
        0.45,
        0
      ]
    }
  },
  "mace": {
    "id": "mace",
    "name": "Mace",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "mace-heavy",
      "baseName": "Mace",
      "handsRequired": 1,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 28,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "mace",
      "studioId": "mace",
      "visualClass": "mace",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/mace.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.15,
        0
      ],
      "nativeScale": 0.359722,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "mace.zip",
        "sourceSha256": "900218e5da3b8a1017d4e48868b8f8e419c710328873f054ff9f82e5ff7d6bb8"
      },
      "runtimeAsset": {
        "bytes": 303360,
        "sha256": "0c2b191d2d8a9d3314f332489143bc18d4f08fbd649d5029ba9ceff23787214d",
        "triangles": 894,
        "textureResolution": 256
      }
    }
  },
  "morning-star": {
    "id": "morning-star",
    "name": "Morning Star",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "morning-star",
      "baseName": "Morning Star",
      "handsRequired": 1,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 30,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "morning-star",
      "studioId": "morning-star",
      "visualClass": "morning-star",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/morning-star.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.15,
        0
      ],
      "nativeScale": 0.385417,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "medieval-mace.zip",
        "sourceSha256": "984851baa2f51f0c1875a7e5e78afcd7ef8a31ea93284d007ebbe8c276647cb7"
      },
      "runtimeAsset": {
        "bytes": 334952,
        "sha256": "e9adb44ff87d40b68bc08eee8f499d8b83294c7c7800d764f05507804d1e069d",
        "triangles": 4800,
        "textureResolution": 256
      }
    }
  },
  "flail": {
    "id": "flail",
    "name": "Flail",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "flail-light",
      "baseName": "Flail",
      "handsRequired": 1,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 42,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "flail",
      "studioId": "flail",
      "visualClass": "flail",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/flail.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.15,
        0
      ],
      "nativeScale": 0.539583,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "medieval-flail.zip",
        "sourceSha256": "b0806245e893f8466e680b6db2925f8ec8ef7975ff4de325be69f3934baa72c3"
      },
      "runtimeAsset": {
        "bytes": 416084,
        "sha256": "683728f5311725f44d23dc607d4d8275b1655cefa0eaa4e579f153073ac097eb",
        "triangles": 4800,
        "textureResolution": 256
      }
    }
  },
  "club": {
    "id": "club",
    "name": "Club",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "club",
      "baseName": "Club",
      "handsRequired": 1,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 28,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "club",
      "studioId": "club",
      "visualClass": "club",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/club.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "one-handed-swing",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.15,
        0
      ],
      "nativeScale": 0.359722,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -90,
        0,
        0
      ],
      "source": {
        "originalFilename": "neolithic_stone_club.zip",
        "sourceSha256": "f8e7018f6df179e1a4632672abe5576b843835c2b7200d633a74a323e8d2ad18"
      },
      "runtimeAsset": {
        "bytes": 183384,
        "sha256": "89cc8421a9474360d38e2a68e024c8a8fac6206aa111007ce56cc53a21b3d9b2",
        "triangles": 576,
        "textureResolution": 256
      }
    }
  },
  "horse-head-staff": {
    "id": "horse-head-staff",
    "name": "Horse Head Staff",
    "category": "weapon",
    "slot": "weapon",
    "rules": {
      "catalogWeaponId": "staff",
      "baseName": "Horse Head Staff",
      "handsRequired": 1,
      "damageType": "bludgeoning"
    },
    "physical": {
      "authoredLengthInches": null,
      "calibratedLengthInches": 60,
      "status": "Provisional Studio length; scale and grip remain adjustable."
    },
    "appearance": {
      "appearanceId": "horse-head-staff",
      "studioId": "horse-head-staff",
      "visualClass": "wizard-staff",
      "representation": "optimized-gltf-v1",
      "asset": "assets/models/weapons/batch-196/horse-head-staff.glb",
      "attachment": "right-hand",
      "handsRequired": 1,
      "poseProfileId": "wizard-staff-grip",
      "primaryAxis": [
        0,
        1,
        0
      ],
      "grip": [
        0,
        0.55,
        0
      ],
      "nativeScale": 0.770833,
      "defaultSizePercent": 100,
      "position": [
        0.015,
        0.05,
        0.005
      ],
      "rotationDegrees": [
        -69.201659,
        -33.008024,
        46.485403
      ],
      "source": {
        "originalFilename": "tmk_21816kp14913_shamaanin_sauva_-_shaman_staff.zip",
        "sourceSha256": "0f709f34a12cafa02073bb89c36ca8d86365e1b7288c17045c9a1ca808c5ab42"
      },
      "runtimeAsset": {
        "bytes": 595680,
        "sha256": "bd3328677f6d501b4b9a0d5879225422c8d064ed3a913614d3f15922afae2e6f",
        "triangles": 4800,
        "textureResolution": 256
      }
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

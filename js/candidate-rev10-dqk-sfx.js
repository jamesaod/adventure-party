/*
  Candidate Rev 10 — Dark Queen of Krynn SFX pass
  =================================================
  Uses three digitized effects extracted from the user's Dark Queen of Krynn
  SFXDQ.VOC bank:

    SFX 09 — Fireball explosion/effect
    SFX 02 — hostile spell effect successfully takes hold
    SFX 07 — adjacent/melee miss

  Ranged/projectile misses keep the established ranged miss sound.
*/

const CANDIDATE_REV10_DQK_SFX=Object.freeze({
  fireball:{
    id:9,
    url:"assets/audio/dqk-sfx-09-fireball.wav",
    gain:0.82
  },
  spellAffect:{
    id:2,
    url:"assets/audio/dqk-sfx-02-spell-affect.wav",
    gain:0.74
  },
  meleeMiss:{
    id:7,
    url:"assets/audio/dqk-sfx-07-melee-miss.wav",
    gain:0.76
  }
});

const candidateRev10DqkRawBuffers=new Map();
const candidateRev10DqkAudioBuffers=new Map();
const candidateRev10DqkDecodePromises=new Map();


function candidateRev10PrimeDqkSfx(){
  for(const [key,spec] of Object.entries(CANDIDATE_REV10_DQK_SFX)){
    if(candidateRev10DqkRawBuffers.has(key)) continue;

    fetch(spec.url)
      .then(response=>{
        if(!response.ok){
          throw new Error(
            `DQK SFX ${spec.id} failed to load: HTTP ${response.status}`
          );
        }
        return response.arrayBuffer();
      })
      .then(buffer=>{
        candidateRev10DqkRawBuffers.set(key,buffer);
      })
      .catch(error=>{
        console.error(error);
      });
  }
}


function candidateRev10DecodedDqkBuffer(key){
  if(
    !audioCtx ||
    !audioReady
  ){
    return Promise.resolve(null);
  }

  const cached=
    candidateRev10DqkAudioBuffers.get(key);

  if(
    cached &&
    candidateRev10DqkAudioBuffers.get(key+"_ctx")===audioCtx
  ){
    return Promise.resolve(cached);
  }

  const pending=
    candidateRev10DqkDecodePromises.get(key);

  if(pending){
    return pending;
  }

  const spec=
    CANDIDATE_REV10_DQK_SFX[key];

  if(!spec){
    return Promise.resolve(null);
  }

  const acquire=
    candidateRev10DqkRawBuffers.has(key)
      ? Promise.resolve(
          candidateRev10DqkRawBuffers.get(key)
        )
      : fetch(spec.url)
          .then(response=>{
            if(!response.ok){
              throw new Error(
                `DQK SFX ${spec.id} failed to load: HTTP ${response.status}`
              );
            }
            return response.arrayBuffer();
          })
          .then(buffer=>{
            candidateRev10DqkRawBuffers.set(key,buffer);
            return buffer;
          });

  const decoding=
    acquire
      .then(buffer=>
        audioCtx.decodeAudioData(
          buffer.slice(0)
        )
      )
      .then(decoded=>{
        candidateRev10DqkAudioBuffers.set(
          key,
          decoded
        );
        candidateRev10DqkAudioBuffers.set(
          key+"_ctx",
          audioCtx
        );
        candidateRev10DqkDecodePromises.delete(key);
        return decoded;
      })
      .catch(error=>{
        candidateRev10DqkDecodePromises.delete(key);
        console.error(error);
        return null;
      });

  candidateRev10DqkDecodePromises.set(
    key,
    decoding
  );

  return decoding;
}


function candidateRev10PlayDqkSfx(
  key,
  gainMultiplier=1
){
  const spec=
    CANDIDATE_REV10_DQK_SFX[key];

  if(!spec){
    return false;
  }

  queueSfx(()=>{
    candidateRev10DecodedDqkBuffer(key)
      .then(buffer=>{
        if(
          !buffer ||
          !audioCtx ||
          !audioReady ||
          !sfxGain
        ){
          return;
        }

        const source=
          audioCtx.createBufferSource();

        const gain=
          audioCtx.createGain();

        source.buffer=buffer;

        gain.gain.setValueAtTime(
          Math.max(
            0.0001,
            Number(spec.gain||1)*
            Math.max(
              0,
              Number(gainMultiplier)||0
            )
          ),
          audioCtx.currentTime
        );

        source.connect(gain);
        gain.connect(sfxGain);
        source.start();
      });
  });

  return true;
}


function playDqkFireballSound(){
  return candidateRev10PlayDqkSfx(
    "fireball"
  );
}


function playDqkSpellAffectSound(){
  return candidateRev10PlayDqkSfx(
    "spellAffect"
  );
}


function playDqkMeleeMissSound(){
  return candidateRev10PlayDqkSfx(
    "meleeMiss"
  );
}


/* ============================================================
   FIREBALL — DQK SFX 09
   ============================================================ */

let candidateRev10ResolvingSpellId=null;

const candidateRev10BaseCastPreparedCombatSpell=
  castPreparedCombatSpell;

castPreparedCombatSpell=async function(
  action,
  targetHex,
  targetUnit
){
  const previous=
    candidateRev10ResolvingSpellId;

  candidateRev10ResolvingSpellId=
    action?.spellId || null;

  try{
    return await candidateRev10BaseCastPreparedCombatSpell(
      action,
      targetHex,
      targetUnit
    );
  }finally{
    candidateRev10ResolvingSpellId=
      previous;
  }
};


const candidateRev10BasePlayFireballExplosionSound=
  playFireballExplosionSound;

playFireballExplosionSound=function(){
  if(
    candidateRev10ResolvingSpellId==="fireball"
  ){
    return playDqkFireballSound();
  }

  /*
    Flaming Sphere and any other non-Fireball caller retain their established
    sound rather than inheriting the new Fireball sample accidentally.
  */
  return candidateRev10BasePlayFireballExplosionSound();
};


/* ============================================================
   FAILED-SAVE / HOSTILE SPELL-AFFECT FEEDBACK — DQK SFX 02
   ============================================================ */

const CANDIDATE_REV10_SPELL_AFFECT_DEBUFF_IDS=new Set([
  "blind",
  "charm-person",
  "deafness",
  "held-person",
  "held-undead",
  "hideous-laughter",
  "hypnotic-pattern",
  "nauseated",
  "ray-enfeeblement",
  "scare",
  "sleep",
  "slow",
  "spook",
  "taunt",
  "webbed"
]);

const CANDIDATE_REV10_SPELL_AFFECT_SOURCE_NAMES=new Set([
  "Color Spray",
  "Glitterdust",
  "Grease",
  "Light"
]);


function candidateRev10IsHostileSpellAffect(
  unit,
  effectSpec
){
  if(
    !unit ||
    !effectSpec ||
    effectSpec.kind!=="debuff"
  ){
    return false;
  }

  const id=
    String(
      effectSpec.id || ""
    );

  if(
    CANDIDATE_REV10_SPELL_AFFECT_DEBUFF_IDS.has(id)
  ){
    return true;
  }

  const sourceName=
    String(
      effectSpec.data?.sourceName ||
      effectSpec.data?.source ||
      ""
    );

  if(
    CANDIDATE_REV10_SPELL_AFFECT_SOURCE_NAMES.has(
      sourceName
    )
  ){
    return [
      "blind",
      "prone",
      "stunned",
      "unconscious"
    ].includes(id);
  }

  return false;
}


const candidateRev10BaseAddUnitEffect=
  addUnitEffect;

addUnitEffect=function(
  unit,
  effectSpec
){
  const alreadyHad=
    !!(
      unit &&
      effectSpec?.id &&
      getUnitEffect(
        unit,
        effectSpec.id
      )
    );

  const effect=
    candidateRev10BaseAddUnitEffect(
      unit,
      effectSpec
    );

  /*
    Play only when the hostile spell condition actually lands on this creature,
    not merely when a save is rolled. This also covers Sleep, which the user
    wants to share the successful-spell-affect cue even though its rules path
    does not necessarily use an ordinary saving throw.
  */
  if(
    effect &&
    !alreadyHad &&
    candidateRev10IsHostileSpellAffect(
      unit,
      effectSpec
    )
  ){
    playDqkSpellAffectSound();
  }

  return effect;
};


/* ============================================================
   ADJACENT / MELEE MISS — DQK SFX 07
   ============================================================ */

const candidateRev10BaseAttack=
  attack;

attack=function(
  attacker,
  defender,
  options={}
){
  const baseMissSound=
    playMissSound;

  /*
    The generic attack() path is the adjacent physical/melee attack path.
    Longbow, sling, projectile spell and other ranged resolvers use their own
    attack functions and therefore retain the established ranged miss sound.
  */
  playMissSound=
    playDqkMeleeMissSound;

  try{
    return candidateRev10BaseAttack(
      attacker,
      defender,
      options
    );
  }finally{
    playMissSound=
      baseMissSound;
  }
};


candidateRev10PrimeDqkSfx();


window.AdventurePartyDqkSfx={
  channel:"candidate",
  candidateRevision:10,
  sources:{
    fireball:9,
    spellAffect:2,
    meleeMiss:7
  },
  playFireball:
    playDqkFireballSound,
  playSpellAffect:
    playDqkSpellAffectSound,
  playMeleeMiss:
    playDqkMeleeMissSound,
  inspect:()=>({
    rawLoaded:[
      ...candidateRev10DqkRawBuffers.keys()
    ].filter(key=>!key.endsWith("_ctx")),
    decoded:[
      ...candidateRev10DqkAudioBuffers.keys()
    ].filter(key=>!key.endsWith("_ctx"))
  })
};

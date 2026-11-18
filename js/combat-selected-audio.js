// Selected recordings share the existing context, SFX gain and mute lifecycle.
const selectedCombatAudioPools={
  "impact-hill-giant": ["assets/audio/sfx/hill-giant/earth1-club.wav"],
  "step-hill-giant": [1,2,3,4,5].map(n=>"assets/audio/sfx/hill-giant/step-"+n+".wav"),
  "step-grass": ["assets/audio/sfx/terrain-steps/approved/grass-trexlasso-01.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-02.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-03.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-04.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-05.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-06.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-07.wav","assets/audio/sfx/terrain-steps/approved/grass-trexlasso-08.wav"],
  "step-dirt": [
    "assets/audio/sfx/terrain-steps/dirt-1.wav"
  ],
  "step-mud": [
    "assets/audio/sfx/terrain-steps/approved/mud-01.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-02.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-03.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-04.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-05.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-06.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-07.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-08.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-09.wav",
    "assets/audio/sfx/terrain-steps/approved/mud-10.wav"
  ],
  "step-water": [
    "assets/audio/sfx/terrain-steps/approved/water-01.wav",
    "assets/audio/sfx/terrain-steps/approved/water-02.wav",
    "assets/audio/sfx/terrain-steps/approved/water-03.wav",
    "assets/audio/sfx/terrain-steps/approved/water-04.wav",
    "assets/audio/sfx/terrain-steps/approved/water-05.wav",
    "assets/audio/sfx/terrain-steps/approved/water-06.wav",
    "assets/audio/sfx/terrain-steps/approved/water-07.wav",
    "assets/audio/sfx/terrain-steps/approved/water-08.wav",
    "assets/audio/sfx/terrain-steps/approved/water-09.wav",
    "assets/audio/sfx/terrain-steps/approved/water-10.wav",
    "assets/audio/sfx/terrain-steps/approved/water-11.wav"
  ]
};
const selectedCombatAudioClips=new Map(),selectedCombatAudioLast=new Map(),selectedCombatAudioVoices=new Set();
let selectedCombatAudioGeneration=0;
for(const file of Object.values(selectedCombatAudioPools).flat())selectedCombatAudioClips.set(file,{bytes:fetch(file).then(r=>{if(!r.ok)throw Error(r.status+' '+file);return r.arrayBuffer();}).catch(e=>{console.warn('Combat sample unavailable',e);return null;})});
function preloadSelectedCombatAudio(context){return Promise.all([...selectedCombatAudioClips.values()].map(c=>c.loading??=(c.bytes.then(b=>b&&context.decodeAudioData(b.slice(0))).then(b=>c.buffer=b).catch(e=>{console.warn('Combat sample decode failed',e);return null;}))));}
function stopSelectedCombatAudio(){selectedCombatAudioGeneration++;for(const voice of [...selectedCombatAudioVoices])voice.stop();}
function playSelectedCombatAudio(poolKey,volume){
 if(!audioEnabled||!audioCtx||audioCtx.state!=='running'||currentScreen!=='combat'||selectedCombatAudioVoices.size>=12)return false;
 if(poolKey.startsWith('step-')&&[...selectedCombatAudioVoices].filter(v=>v.step).length>=8)return false;
 const file=chooseCombatAudioClip(selectedCombatAudioPools[poolKey],selectedCombatAudioLast.get(poolKey));if(!file)return false;
 const clip=selectedCombatAudioClips.get(file),context=audioCtx,session=game,generation=selectedCombatAudioGeneration,requested=performance.now();
 const start=buffer=>{if(!buffer||!audioEnabled||game!==session||currentScreen!=='combat'||generation!==selectedCombatAudioGeneration||context.state!=='running'||performance.now()-requested>150||selectedCombatAudioVoices.size>=12)return;
  selectedCombatAudioLast.set(poolKey,file);const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(sfxGain);
  const voice={step:poolKey.startsWith('step-'),stop(){try{source.stop();}catch{}source.disconnect();gain.disconnect();selectedCombatAudioVoices.delete(voice);}};selectedCombatAudioVoices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();selectedCombatAudioVoices.delete(voice);};source.start();
 };
 if(clip.buffer)start(clip.buffer);else{preloadSelectedCombatAudio(context);clip.loading.then(start);}return true;
}
globalThis.adventurePartyTerrainStep=(kind,entity)=>{
 const pool=combatTerrainStepPool(kind,entity),giant=pool==='step-hill-giant';
 const waterGain=kind==='water'?combatWaterStepVolumeScale(entity):1;
 const played=playSelectedCombatAudio(pool,giant?.6384:kind==='water'?.30*waterGain:kind==='mud'?.15:kind==='grass'?.48:.24);
 if(giant&&(kind==='water'||kind==='mud'))playSelectedCombatAudio('step-'+kind,kind==='water'?.22*waterGain:.12);
 return played;
};
globalThis.adventurePartyPreloadSelectedAudio=preloadSelectedCombatAudio;
globalThis.adventurePartyStopSelectedAudio=stopSelectedCombatAudio;
globalThis.adventurePartySelectedAudioDiagnostics=()=>({loaded:[...selectedCombatAudioClips.values()].filter(c=>c.buffer).length,total:selectedCombatAudioClips.size,active:selectedCombatAudioVoices.size,last:Object.fromEntries(selectedCombatAudioLast)});

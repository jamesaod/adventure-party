/* Selected CC0 recordings; provenance is in assets/audio/sfx/bow/selection.json.
 * Uses the game's AudioContext/mixer. No new timers, audio context or render loop.
 */
const bowAudioClips={
  draw:{file:'draw.wav',gain:.425},release:{file:'release.wav',gain:.9},
  flight:{file:'flight.wav',gain:.5},hit:{file:'hit.wav',gain:.9},miss:{file:'miss.wav',gain:.85}
};
const bowAudioVoices=new Set();
let bowAudioGeneration=0;

// Fetch while the launcher loads; decode once the user's audio context exists.
for(const clip of Object.values(bowAudioClips)){
  clip.bytes=fetch('assets/audio/sfx/bow/'+clip.file+'?v=R238C303')
    .then(response=>{if(!response.ok)throw Error(response.status+' '+clip.file);return response.arrayBuffer();})
    .catch(error=>{console.warn('Bow audio unavailable:',error);return null;});
}
function preloadBowAudio(context){
  return Promise.all(Object.values(bowAudioClips).map(clip=>{
    if(!clip.decoded)clip.decoded=clip.bytes.then(bytes=>bytes&&context.decodeAudioData(bytes.slice(0)))
      .then(buffer=>clip.buffer=buffer).catch(error=>{console.warn('Bow audio decode failed:',error);return null;});
    return clip.decoded;
  }));
}
function usesSelectedBowAudio(unit){return !!unit&&/^bow-/.test(unit.missileCatalogId||'bow-long');}
function stopBowSounds(){
  bowAudioGeneration++;
  for(const voice of [...bowAudioVoices])voice.stop();
}
function playBowSample(role,{delay=0,duration=Infinity}={}){
  if(!audioEnabled||!audioCtx||audioCtx.state!=='running'||currentScreen!=='combat')return null;
  const clip=bowAudioClips[role],context=audioCtx,combat=game,generation=bowAudioGeneration;
  const scheduled=performance.now()+delay*1000;
  let source=null,gain=null,stopped=false;
  const voice={stop(){
    stopped=true;bowAudioVoices.delete(voice);
    if(source){try{source.stop();}catch{}source.disconnect();gain.disconnect();}
  }};
  bowAudioVoices.add(voice);
  const start=buffer=>{
    const late=Math.max(0,(performance.now()-scheduled)/1000);
    // Do not replay a shot after mute, a scene change, or a slow first download.
    if(!buffer||stopped||generation!==bowAudioGeneration||game!==combat||!audioEnabled||
      currentScreen!=='combat'||context.state!=='running'||late>(role==='draw'?duration:.12)){
      voice.stop();return;
    }
    const length=Math.min(buffer.duration,duration)-late;
    if(length<=.005){voice.stop();return;}
    const when=context.currentTime+Math.max(0,(scheduled-performance.now())/1000);
    source=context.createBufferSource();source.buffer=buffer;
    gain=context.createGain();source.connect(gain);gain.connect(sfxGain);
    gain.gain.setValueAtTime(0,when);
    gain.gain.linearRampToValueAtTime(clip.gain,when+Math.min(.005,length/3));
    gain.gain.setValueAtTime(clip.gain,when+Math.max(.005,length-.012));
    gain.gain.linearRampToValueAtTime(0,when+length);
    source.onended=()=>{bowAudioVoices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(when,late,length);
  };
  if(clip.buffer)start(clip.buffer);
  else{preloadBowAudio(context);clip.decoded.then(start);}
  return voice;
}
function playBowDrawSound(unit,windupMs,drawDelayMs=0){
  if(!usesSelectedBowAudio(unit)||(Number.isFinite(unit.missileAmmoQuantity)&&unit.missileAmmoQuantity<=0))return null;
  // Keep the recording's pitch; the draw finishes at the authored release time.
  const duration=Math.min(1.7,Math.max(0,windupMs-(Number(drawDelayMs)||0))/1000);
  return duration>0?playBowSample('draw',{delay:Math.max(0,windupMs/1000-duration),duration}):null;
}
function playBowReleaseSound(unit){
  if(!usesSelectedBowAudio(unit))return null;
  const release=playBowSample('release'),flight=playBowSample('flight',{delay:.025});
  return {stop(){release?.stop();flight?.stop();}};
}
function playBowImpactSound(unit,hit){
  if(usesSelectedBowAudio(unit))playBowSample(hit?'hit':'miss');
}

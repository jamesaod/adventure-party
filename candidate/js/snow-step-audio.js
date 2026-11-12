// CC0 qubodup; originals, processing and hashes: assets/audio/sfx/snow/SOURCE.json.
const snowStepClips=Array.from({length:4},(_,i)=>({bytes:fetch('assets/audio/sfx/snow/step-'+(i+1)+'.wav').then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).catch(e=>{console.warn('Snow step unavailable',e);return null;})}));
const snowStepVoices=new Set();let lastSnowStep=-1;
function preloadSnowStepAudio(context){return Promise.all(snowStepClips.map(c=>c.loading??=(c.bytes.then(b=>b&&context.decodeAudioData(b.slice(0))).then(b=>c.buffer=b).catch(e=>{console.warn('Snow step decode failed',e);return null;}))));}
function stopSnowStepAudio(){for(const source of snowStepVoices){try{source.stop();}catch{}}snowStepVoices.clear();}
globalThis.adventurePartySnowStep=depth=>{
 if(!(depth>0)||!audioEnabled||!audioCtx||audioCtx.state!=='running'||currentScreen!=='combat'||snowStepVoices.size>=8)return;
 let index=(lastSnowStep+1+Math.floor(Math.random()*3))%4;const clip=snowStepClips[index];if(!clip.buffer){preloadSnowStepAudio(audioCtx);return;}
 lastSnowStep=index;const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=clip.buffer;
 gain.gain.value=.1625*Math.sqrt(Math.min(1,depth));source.connect(gain);gain.connect(sfxGain);snowStepVoices.add(source);
 source.onended=()=>{snowStepVoices.delete(source);source.disconnect();gain.disconnect();};source.start();
};

globalThis.adventurePartyPreloadSnowSteps=preloadSnowStepAudio;globalThis.adventurePartyStopSnowSteps=stopSnowStepAudio;

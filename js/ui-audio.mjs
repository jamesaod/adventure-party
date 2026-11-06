// Semantic UI audio: transitions, never generic button clicks.
export function createUiAudio({files,fetchAudio=async url=>{const r=await fetch(url);if(!r.ok)throw Error('UI audio '+r.status);return r.arrayBuffer();},storage=null,createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),defer=queueMicrotask}={}){
 let config={},ownContext=null,gain=null,gainContext=null,voice=null,sequence=0,pending=null,scheduled=false,enabled=true,volume=.45;
 const buffers=new Map();
 const read=key=>{try{return storage?.getItem(key);}catch{return null;}},write=(key,v)=>{try{storage?.setItem(key,v);}catch{}};
 const saved=Number(read('adventure-party-ui-volume'));if(read('adventure-party-ui-volume')!==null&&Number.isFinite(saved))volume=Math.max(0,Math.min(1,saved));enabled=read('adventure-party-audio-muted')!=='true';
 const active=()=>enabled&&(config.isEnabled?.()??true);
 function context(){return config.getContext?.()||(ownContext??=createContext());}
 function stop(){sequence++;pending=null;if(voice){try{voice.stop();}catch{}voice.disconnect();voice=null;}}
 async function emit(kind,ticket){
  if(!active())return;try{const ctx=context();if(ctx.state==='suspended')await ctx.resume();if(ctx.state!=='running'||ticket!==sequence||!active())return;
   if(gainContext!==ctx){gain?.disconnect();gain=ctx.createGain();gain.gain.value=volume;gain.connect(config.getDestination?.()||ctx.destination);gainContext=ctx;}
   if(!buffers.has(kind))buffers.set(kind,fetchAudio(files[kind]).then(data=>ctx.decodeAudioData(data)).catch(error=>{buffers.delete(kind);throw error;}));
   const buffer=await buffers.get(kind);if(ticket!==sequence||!active())return;
   if(voice){try{voice.stop();}catch{}voice.disconnect();}
   const source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);voice=source;source.onended=()=>{source.disconnect();if(voice===source)voice=null;};source.start();config.onPlayed?.(kind);
  }catch(error){console.warn('UI sound unavailable:',error);}
 }
 function play(kind){if(!files[kind]||!active())return false;pending=kind;sequence++;if(!scheduled){scheduled=true;defer(()=>{scheduled=false;const next=pending;pending=null;if(next)void emit(next,sequence);});}return true;}
 function prepareNavigation(kind='open'){if(!active())return;write('adventure-party-ui-pending',JSON.stringify({kind,time:Date.now()}));}
 return {configure(next){config={...config,...next};},play,transition(from,to,kind='open'){return from!==to?play(kind):false;},stop,
  setEnabled(value){enabled=!!value;write('adventure-party-audio-muted',String(!enabled));if(!enabled)stop();},
  setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(gain)gain.gain.value=volume;write('adventure-party-ui-volume',String(volume));},
  prepareNavigation,navigate(url,kind='open'){prepareNavigation(kind);globalThis.location.assign(url);},
  async unlock(){if(!active())return;try{const ctx=context();if(ctx.state==='suspended')await ctx.resume();}catch{}},
  consumeNavigation(){const value=read('adventure-party-ui-pending');if(!value||!active())return false;try{if(context().state!=='running')return false;storage?.removeItem('adventure-party-ui-pending');const entry=JSON.parse(value);if(entry&&Date.now()-entry.time<10000&&files[entry.kind])return play(entry.kind);}catch{}return false;}
 };
}
if(typeof document!=='undefined'){
 let storage;try{storage=sessionStorage;}catch{}
 const api=globalThis.adventurePartyUiAudio||createUiAudio({files:{open:new URL('../assets/audio/sfx/ui/page-open.wav',import.meta.url).href,back:new URL('../assets/audio/sfx/ui/page-back.wav',import.meta.url).href},storage});globalThis.adventurePartyUiAudio=api;api.configure({onPlayed:kind=>{document.documentElement.dataset.uiSound=kind;document.documentElement.dataset.uiSoundCount=String(Number(document.documentElement.dataset.uiSoundCount||0)+1);}});
 const unlock=async()=>{await api.unlock();api.consumeNavigation();};document.addEventListener('pointerdown',unlock,{once:true,capture:true});document.addEventListener('keydown',unlock,{once:true,capture:true});
 // Same-origin page links carry their intent; playback happens at destination.
 document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.download||link.target==='_blank')return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('.html')||url.href===location.href)return;const back=link.dataset.uiSound==='back'||/^(return|back)\b/i.test(link.textContent.trim());api.prepareNavigation(back?'back':'open');});
 document.addEventListener('toggle',event=>{if(event.target.tagName==='DETAILS'&&event.isTrusted)api.play(event.target.open?'open':'back');},true);
 // Previously activated pages may autoplay; otherwise intent waits for a gesture.
 api.consumeNavigation();
 addEventListener('pagehide',()=>api.stop());
}

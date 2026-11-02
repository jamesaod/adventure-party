/** Execute the existing game scripts in order; never expose a partial engine. */
export async function loadGameScripts(entries,{loadScript,onProgress=()=>{}}){
  for(const [index,entry] of entries.entries()){
    onProgress(index,entries.length);
    try{await loadScript(entry,0);}
    catch(error){
      // Only a failed download is safe to retry. An evaluation error may have
      // already installed wrappers or declared global constants.
      if(!error.retryable)throw error;
      await loadScript(entry,1);
    }
  }
  onProgress(entries.length,entries.length);
}

export function scriptRequestUrl(src,baseUrl,{attempt=0,reloadToken=null,now=Date.now()}={}){
  const url=new URL(src,baseUrl);
  if(reloadToken||attempt)url.searchParams.set('gameScriptRetry',attempt?`${reloadToken||'retry'}-${now}`:reloadToken);
  return url.href;
}

export async function loadGameModule(url,{importModule=src=>import(src),timeoutMs=30000}={}){
  let timer;
  try{
    // Module script load events can precede completion of top-level await.
    // import() resolves only after the module and its dependencies evaluate.
    return await Promise.race([importModule(url),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error(`Game module timed out: ${url}`)),timeoutMs);
    })]);
  }finally{clearTimeout(timer);}
}

function appendGameScript(entry,attempt,reloadToken){
  if(entry.type==='module')return loadGameModule(scriptRequestUrl(entry.src,document.baseURI,{attempt,reloadToken}));
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.async=false;
    if(entry.type==='module')script.type='module';
    script.src=scriptRequestUrl(entry.src,document.baseURI,{attempt,reloadToken});
    let evaluationError=null;
    const recordError=event=>{
      if(event.filename===script.src)evaluationError=event.error||new Error(event.message);
    };
    const finish=error=>{
      clearTimeout(timer);
      window.removeEventListener('error',recordError);
      script.onload=script.onerror=null;
      if(error)reject(error);else resolve();
    };
    window.addEventListener('error',recordError);
    script.onload=()=>finish(evaluationError);
    script.onerror=()=>{
      const error=new Error(`Game script could not load: ${entry.src}`);
      // A module error can include partially evaluated dependencies.
      error.retryable=entry.type!=='module'&&!evaluationError;
      script.remove();finish(evaluationError||error);
    };
    // Never retry a timed-out script in this document: it might still execute.
    const timer=setTimeout(()=>finish(new Error(`Game script timed out: ${entry.src}`)),30000);
    document.head.append(script);
  });
}

async function startGame(){
  let signalReady;
  window.adventurePartyGameStartup={ready:new Promise(resolve=>{signalReady=resolve;})};
  const panel=document.getElementById('gameStartup');
  const status=document.getElementById('gameStartupMessage');
  const reload=document.getElementById('gameStartupReload');
  const entries=[...document.querySelectorAll('script[data-game-script]')].map(node=>({
    src:node.getAttribute('src'),type:node.dataset.gameScript
  }));
  const reloadToken=new URLSearchParams(location.search).get('gameReload');
  const blocked=[...document.body.children].filter(node=>node!==panel&&node.tagName!=='SCRIPT')
    .map(node=>({node,inert:node.inert}));
  for(const {node} of blocked)node.inert=true;
  // Inert UI also needs a guard for the engine's document-level shortcuts.
  const blockShortcuts=event=>event.stopImmediatePropagation();
  window.addEventListener('keydown',blockShortcuts,true);
  reload.onclick=()=>{
    const url=new URL(location.href);
    url.searchParams.set('gameReload',String(Date.now()));
    location.replace(url.href);
  };
  try{
    // Preload without evaluation; the execution loop remains strictly ordered.
    for(const entry of entries){
      const link=document.createElement('link');
      link.rel=entry.type==='module'?'modulepreload':'preload';
      if(entry.type!=='module')link.as='script';
      link.href=scriptRequestUrl(entry.src,document.baseURI,{reloadToken});
      document.head.append(link);
    }
    await loadGameScripts(entries,{
      loadScript:(entry,attempt)=>appendGameScript(entry,attempt,reloadToken),
      onProgress:(done,total)=>{status.textContent=`Loading game… ${done}/${total}`;}
    });
    if(typeof window.AdventurePartyLevel3Spells?.cleanupInvisibilityRadius!=='function'||
       typeof window.adventurePartySpriteSets?.register!=='function'||
       typeof window.adventurePartyRepositoryMobs?.canTest!=='function'){
      throw new Error('Required combat or sprite APIs did not initialize.');
    }
    for(const {node,inert} of blocked)node.inert=inert;
    window.removeEventListener('keydown',blockShortcuts,true);
    panel.remove();
    signalReady();
  }catch(error){
    console.error('Adventure Party startup failed:',error);
    status.textContent='The game could not finish loading. Reload to try again.';
    reload.focus();
  }
}

if(typeof document!=='undefined'&&document.getElementById('gameStartup'))void startGame();

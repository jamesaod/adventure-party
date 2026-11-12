import {listPreparedAssets,pendingPreparedAssets,writePreparedAsset,finishPreparedAsset} from './combat-prepared-store.mjs';
import {preparedAssetKey,serializePreparedAsset,validatePreparedAsset} from './combat-prepared-assets.mjs';

// Explicit authoring operation: never imported or invoked by combat's loader.
const loadoutLabel=recipe=>`${recipe.mob.name||recipe.mob.type} / ${recipe.equipment?.itemName||'Unarmed'} / ${recipe.shield?.itemName||'No shield'}`;
const host=document.getElementById('studioPreparedModels');
if(host){
  host.innerHTML='<h3>Prepared battlefield models</h3><p>Build model/equipment combinations requested by combat once, then save the assets. This can take several minutes. Combat only loads the results.</p><button type="button" id="buildPreparedModels">Build pending models</button> <button type="button" id="refreshPreparedModels">Refresh list</button><p id="preparedModelStatus" role="status"></p><div id="preparedModelExports"></div>';
  const build=host.querySelector('#buildPreparedModels'),status=host.querySelector('#preparedModelStatus'),exports=host.querySelector('#preparedModelExports');
  async function showSaved(){
    for(const a of exports.querySelectorAll('a'))URL.revokeObjectURL(a.href);
    exports.replaceChildren();
    for(const pack of await listPreparedAssets()){
      if(pack.cameraFrameVersion!==1)continue; // Old camera exports must not replace corrected asset files.
      const row=document.createElement('p'),link=document.createElement('a');
      link.href=URL.createObjectURL(await new Response(new Blob([JSON.stringify(pack)]).stream().pipeThrough(new CompressionStream('gzip'))).blob());link.download=pack.key+'.json.gz';link.textContent='Save '+loadoutLabel(pack.recipe);row.append(link);exports.append(row);
    }
  }
  showSaved().catch(error=>status.textContent=error.message);
  async function refresh(){const recipes=await pendingPreparedAssets();status.textContent=recipes.length?`${recipes.length} model/equipment combination(s) waiting: ${recipes.map(loadoutLabel).join(', ')}`:'No pending combat models.';return recipes;}
  host.querySelector('#refreshPreparedModels').onclick=()=>refresh().catch(error=>status.textContent=error.message);
  build.onclick=async()=>{
    build.disabled=true;
    try{
      const recipes=await refresh();if(!recipes.length)return;
      const {generateCombatSpriteSet}=await import('./combat-mob-renderer.mjs');
      for(let i=0;i<recipes.length;i++){
        const recipe=recipes[i],key=preparedAssetKey(recipe),started=performance.now();
        const set=await generateCombatSpriteSet(structuredClone(recipe),{onProgress:({step})=>status.textContent=`Building ${i+1}/${recipes.length}: ${recipe.mob.name||recipe.mob.type} — ${step}`});
        // These raster files are effect masks only; the visible body is 3D.
        for(const file of Object.keys(set.sourceUrls)){
          const image=set.images[file]||set.runtimeImages[file],canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);set.sourceUrls[file]=canvas.toDataURL('image/png');
        }
        const pack=serializePreparedAsset(recipe,set);pack.buildSeconds=(performance.now()-started)/1000;validatePreparedAsset(pack,key);
        await writePreparedAsset(key,pack);await finishPreparedAsset(key);
        const row=document.createElement('p'),link=document.createElement('a');
        link.href=URL.createObjectURL(await new Response(new Blob([JSON.stringify(pack)]).stream().pipeThrough(new CompressionStream('gzip'))).blob());link.download=`${key}.json.gz`;link.textContent=`Save ${loadoutLabel(recipe)} asset (${((performance.now()-started)/1000).toFixed(1)} seconds)`;
        row.append(link);exports.append(row);
      }
      status.textContent='Build complete. Ready for combat in this browser. Save each asset into assets/combat-units/ for other browsers and repository delivery.';
    }catch(error){console.error(error);status.textContent=`Build failed: ${error.message}. Existing assets were kept.`;}finally{build.disabled=false;}
  };
  refresh().catch(error=>status.textContent=error.message);
}

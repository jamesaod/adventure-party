import {pendingPreparedAssets,writePreparedAsset,finishPreparedAsset} from './combat-prepared-store.mjs';
import {serializePreparedAsset,preparedAssetKey} from './combat-prepared-assets.mjs';
const status=document.querySelector('#status'),button=document.querySelector('#build');
button.onclick=async()=>{
 button.disabled=true;
 try{
  const recipes=(await pendingPreparedAssets()).filter(r=>r.equipment?.asset?.includes('/low-poly-medieval/'));
  const {generateCombatSpriteSet}=await import('./combat-mob-renderer.mjs');
  for(let i=0;i<recipes.length;i++){
   const recipe=recipes[i],key=preparedAssetKey(recipe),label=`${i+1}/${recipes.length}: ${recipe.equipment.itemName} / ${recipe.shield?.itemName||'No shield'}`;
   const exists=await fetch(`assets/combat-units/${key}.json.gz`,{method:'HEAD'});
   if(exists.ok){await finishPreparedAsset(key);continue;}
   const set=await generateCombatSpriteSet(recipe,{onProgress:({step})=>status.textContent=label+' — '+step});
   for(const file of Object.keys(set.sourceUrls)){
    const image=set.images[file]||set.runtimeImages[file],canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);set.sourceUrls[file]=canvas.toDataURL('image/png');
   }
   const pack=serializePreparedAsset(recipe,set);await writePreparedAsset(key,pack);
   const blob=await new Response(new Blob([JSON.stringify(pack)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
   const saved=await fetch(`http://127.0.0.1:8278/${key}`,{method:'POST',body:blob});if(!saved.ok)throw Error('Local asset writer unavailable');
   await finishPreparedAsset(key);status.textContent=label+' — saved';
  }
  status.textContent='All queued weapon models saved. Ready for combat in any local browser.';
 }catch(e){status.textContent=e.stack;console.error(e);}finally{button.disabled=false;}
};

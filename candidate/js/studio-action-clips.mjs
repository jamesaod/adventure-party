import {createActionEntry,bindActionEntry,readActionLibrary,saveActionLibrary,validateActionLibrary} from './combat-action-clips.mjs';
export function createStudioActionClips({getContext,preview}){
 const host=document.getElementById('studioActionClips');if(!host)return;
 host.innerHTML=`<h3>Battlefield action animations</h3>
 <p>Use the selected animation, choose its start and end in seconds, then preview or save. Add several Death entries for random selection in combat. Deaths hold their final pose.</p>
 <label class="studio-field">Action <select data-kind><option value="attack">Attack</option><option value="death">Death</option></select></label>
 <label class="studio-field">Name <input data-name maxlength="120" placeholder="For example, Fall backwards"></label>
 <label class="studio-field">Start (seconds) <input data-start type="number" min="0" step="0.01" value="0"></label>
 <label class="studio-field">End (seconds) <input data-end type="number" min="0" step="0.01" value="1"></label>
 <label class="studio-field">Speed <input data-speed type="number" min="0.1" max="4" step="0.1" value="1"></label>
 <div><button class="studio-button" type="button" data-source>Use selected clip</button> <button class="studio-button" type="button" data-preview>Preview once</button> <button class="studio-button" type="button" data-save>Save new action</button></div>
 <p data-status role="status"></p><div data-list></div>
 <button class="studio-button" type="button" data-export>Export action library</button> <label class="studio-field">Import library <input type="file" data-import accept=".json"></label>
 <p>Saved locally for this model. Reload combat after saving. Export the library to preserve it outside this browser. Attack clips are authored here; attack timing integration is a separate step.</p>`;
 const q=s=>host.querySelector('[data-'+s+']');let library=null,modelId='',source=null;
 const status=s=>q('status').textContent=s;
 async function refresh(){const c=getContext();if(c.modelId!==modelId){modelId=c.modelId;source=null;library=null;}if(!modelId)throw Error('Load a repository model first.');library=await readActionLibrary(modelId)||{version:1,modelId,entries:[]};render();return c;}
 function render(){q('list').replaceChildren();for(const e of library.entries){const row=document.createElement('p');row.textContent=`${e.kind}: ${e.name} · ${(e.clip.duration/e.speed).toFixed(2)}s `;
 const play=document.createElement('button');play.type='button';play.textContent='Preview';play.onclick=()=>run(async()=>{const c=await refresh();preview(bindActionEntry(c.model,e),e.speed);});
 const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>run(async()=>{await refresh();library.entries=library.entries.filter(x=>x.id!==e.id);await saveActionLibrary(library);render();});row.append(play,remove);q('list').append(row);}}
 async function run(fn){try{await fn();}catch(e){status(e.message);}}
 function entry(c){if(!source)source=c.clip;if(!source)throw Error('Select an animation first.');return createActionEntry(c.model,source,{name:q('name').value||source.name,kind:q('kind').value,start:Number(q('start').value),end:Number(q('end').value),speed:Number(q('speed').value)});}
 q('source').onclick=()=>run(async()=>{const c=await refresh();source=c.clip;if(!source)throw Error('Select an animation first.');q('start').value=0;q('end').value=source.duration;q('name').value=source.name;status('Selected '+source.name);});
 q('preview').onclick=()=>run(async()=>{const c=await refresh(),e=entry(c);preview(bindActionEntry(c.model,e),e.speed);status('Playing selected range once.');});
 q('save').onclick=()=>run(async()=>{const c=await refresh(),e=entry(c);library.entries.push(e);await saveActionLibrary(library);render();status('Saved '+e.name+' for '+modelId+'.');});
 q('export').onclick=()=>run(async()=>{await refresh();const url=URL.createObjectURL(new Blob([JSON.stringify(library,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=modelId+'-actions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 q('import').onchange=()=>run(async()=>{const c=await refresh(),file=q('import').files[0];if(!file)return;const value=validateActionLibrary(JSON.parse(await file.text()),modelId);for(const e of value.entries)bindActionEntry(c.model,e);await saveActionLibrary(value);library=value;render();status('Imported action library.');});
 document.getElementById('studioModelLibrary')?.addEventListener('change',()=>{modelId='';source=null;library=null;q('list').replaceChildren();status('Load the model, then use its selected clip.');});
 return {refresh:()=>run(refresh)};
}

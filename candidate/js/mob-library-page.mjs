import {loadMobLibrary} from './mob-library.mjs?v=R238C204';
import {renderMobPreview} from './mob-preview.mjs?v=R238C205';
const root=document.getElementById('mobCards'),status=document.getElementById('libraryStatus');
try{const {library,catalog}=await loadMobLibrary();let sequence=Promise.resolve();const previews=new Map();
 const render=()=>{root.replaceChildren();for(const record of library.records()){
 const {mob,origin,ready,reasons}=record;if(!(mob.name+' '+mob.modelId).toLowerCase().includes(document.getElementById('mobSearch').value.toLowerCase()))continue;
 const card=document.createElement('article');card.className='panel mob-card';const title=document.createElement('a');title.href='./mob-creator.html?mob='+encodeURIComponent(mob.id);title.textContent=mob.name;
 const stage=document.createElement('div');stage.className='preview-stage';const img=document.createElement('img');img.alt=mob.name+' preview';stage.append(img);
 const detail=document.createElement('p');detail.textContent=origin+' · '+mob.modelId;
 const availability=document.createElement('p');const on=mob.mob.encounterEnabled&&ready;availability.className=on?'status-on':'status-off';availability.textContent=on?'● Available in combat':'● Not available'+(reasons.length?' — '+reasons.join(' '):'');
 const preview=document.createElement('button');preview.textContent='Show appearance';preview.onclick=()=>{preview.disabled=true;sequence=sequence.then(async()=>{try{if(!card.isConnected)return;const key=mob.id+":"+mob.mob.revision;let result=previews.get(key);if(!result){result=await renderMobPreview(mob,catalog);previews.set(key,result);}img.src=result.src;img.style.width=result.frame.renderWidth*2.5+'px';img.style.height=result.frame.renderHeight*2.5+'px';preview.textContent=result.equipment;}catch(error){preview.textContent=error.message;}finally{preview.disabled=false;}});};
 card.append(title,stage,detail,availability,preview);root.append(card);preview.click();
 }status.textContent=root.children.length+' MOB sheets';};
 document.getElementById('mobSearch').addEventListener('input',render);render();
}catch(error){status.textContent=error.message;}

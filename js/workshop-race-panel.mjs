import {RACE_PROFILES,GENDERS,raceProfile,ensureRaceIdentity} from './racial-traits.mjs?v=R238C311';
export function createWorkshopRacePanel({host,getDraft,changed}){
 const doc=host.ownerDocument;
 const control=(title,id,type)=>{const label=doc.createElement('label');label.textContent=title;const el=doc.createElement(type==='select'?'select':'input');el.id=id;if(type!=='select')el.type=type;label.append(el);host.append(label);return el;};
 const race=control('Race','raceId','select'),gender=control('Gender','gender','select');
 race.replaceChildren(...RACE_PROFILES.map(r=>new Option(r.label,r.id)));gender.replaceChildren(...GENDERS.map(([id,label])=>new Option(label,id)));
 const traits=doc.createElement('p');traits.id='racialTraits';host.append(traits);
 const override=control('Override racial morale for this MOB','moraleOverride','checkbox'),morale=control('Morale (2–20)','morale','number');morale.min=2;morale.max=20;morale.step=1;
 const help=doc.createElement('small');host.append(help);
 function refresh(){
  const d=ensureRaceIdentity(getDraft()),p=raceProfile(d.raceId);
  race.value=d.raceId;gender.value=d.gender;override.checked=d.moraleOverride!==null;morale.disabled=!override.checked;morale.value=d.stats.morale;
  help.textContent=`Race default: ${p.morale}. ${override.checked?'This MOB uses its own morale.':'This MOB inherits racial morale.'}`;
  traits.textContent=d.raceId==='elf'?'+1 to hit and damage with bows and swords. 90% resistance to Sleep and charm-related spells.':'No combat racial bonuses configured for this race.';
  const species=doc.getElementById('species');if(species){species.readOnly=d.raceId!=='unspecified';species.value=d.stats.species;}
 }
 race.onchange=()=>{const d=getDraft();d.raceId=race.value;d.moraleOverride=null;if(d.raceId!=='unspecified')d.stats.species=raceProfile(d.raceId).label;refresh();changed();};
 gender.onchange=()=>{getDraft().gender=gender.value;changed();};
 override.onchange=()=>{getDraft().moraleOverride=override.checked?Number(morale.value):null;refresh();changed();};
 morale.onchange=()=>{const value=Number(morale.value);if(!Number.isInteger(value)||value<2||value>20){morale.setCustomValidity('Enter a whole number from 2 to 20.');morale.reportValidity();return;}morale.setCustomValidity('');getDraft().moraleOverride=value;refresh();changed();};
 refresh();return {refresh};
}

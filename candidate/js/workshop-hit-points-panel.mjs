import {ensureCreature} from './mob-workshop-creature.mjs?v=R238C313';
import {HIT_POINT_MODES,diceParts,hitPointSummary} from './workshop-hit-points.mjs?v=R238C313';

export function createHitPointPanel({host,getDraft,changed}){
 const doc=host.ownerDocument,groups={},controls={};
 const number=(group,id,label,min,max,set)=>{
  const row=doc.createElement('label');row.textContent=label;
  const input=doc.createElement('input');input.id=id;input.type='number';input.min=min;input.max=max;input.step=1;
  input.onchange=()=>{
   const value=Number(input.value);
   if(!String(input.value).trim()||!Number.isInteger(value)||value<min||value>max){input.setCustomValidity(`Enter a whole number from ${min} to ${max}.`);input.reportValidity();input.setCustomValidity('');refresh();return;}
   set(value);changed();refresh();
  };row.append(input);group.box.append(row);group.inputs.push(input);controls[id]=input;
 };
 const combat=()=>ensureCreature(getDraft()).combat;
 function changeDice(){
  const count=controls.hpDiceCount.value,sides=controls.hpDiceSides.value,bonus=Number(controls.hpDiceModifier.value);
  combat().hitDice=`${count}d${sides}${bonus>=0?'+':''}${bonus}`;
 }
 for(const [mode,label] of HIT_POINT_MODES){
  const box=doc.createElement('fieldset'),legend=doc.createElement('legend'),row=doc.createElement('label'),radio=doc.createElement('input');
  radio.type='radio';radio.name='workshop-hp-mode';radio.id='hpMode-'+mode;radio.value=mode;
  row.append(radio,doc.createTextNode(label));legend.append(row);box.append(legend);host.append(box);
  radio.onchange=()=>{if(!radio.checked)return;const c=combat();c.hpMode=mode;if(mode==='roll'&&!diceParts(c.hitDice))c.hitDice='1d8';changed();refresh();};
  groups[mode]={box,radio,inputs:[]};
 }
 number(groups.fixed,'hp','Hit points',1,1000000,value=>getDraft().stats.hp=value);
 number(groups.roll,'hpDiceCount','Number of Hit Dice',1,100,changeDice);
 number(groups.roll,'hpDiceSides','Sides per die (normally 8)',2,1000,changeDice);
 number(groups.roll,'hpDiceModifier','Hit Dice modifier',-99999,99999,changeDice);
 number(groups.range,'hpRangeMin','Minimum HP',1,1000000,value=>combat().hpRangeMin=value);
 number(groups.range,'hpRangeMax','Maximum HP',1,1000000,value=>combat().hpRangeMax=value);
 number(groups.range,'hpRangeModifier','Range modifier',-99999,99999,value=>combat().hpRangeModifier=value);
 const less=doc.createElement('input');less.type='checkbox';less.id='lessThanOneHitDie';
 less.onchange=()=>{combat().lessThanOneHitDie=less.checked;changed();refresh();};
 const row=doc.createElement('label');row.append(less,doc.createTextNode(' Less than 1 Hit Die (eligible for Sweep)'));host.append(row);
 const help=doc.createElement('p');help.textContent='Only the selected HP mode is used. Random HP is generated once per individual, with a minimum of 1. The checkbox sets the Hit Dice classification independently of HP.';host.append(help);
 const summary=doc.createElement('output');summary.id='hpSummary';host.append(summary);
 function refresh(){
  const d=getDraft(),c=combat(),p=diceParts(c.hitDice);
  for(const [mode,group] of Object.entries(groups)){group.radio.checked=mode===c.hpMode;for(const input of group.inputs)input.disabled=mode!==c.hpMode;}
  const values={hp:d.stats.hp,hpDiceCount:p?.count??'',hpDiceSides:p?.sides??'',hpDiceModifier:p?.bonus??'',hpRangeMin:c.hpRangeMin,hpRangeMax:c.hpRangeMax,hpRangeModifier:c.hpRangeModifier};
  for(const [id,value] of Object.entries(values))controls[id].value=value;
  less.checked=c.lessThanOneHitDie;summary.textContent=hitPointSummary(d.stats,c);
 }
 refresh();return {refresh};
}

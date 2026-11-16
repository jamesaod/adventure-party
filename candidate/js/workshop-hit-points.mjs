// Exclusive HP generation policies. Resolve randomness only when creating an individual.
export const HIT_POINT_MODES=[['fixed','Fixed hit points'],['roll','Hit dice + modifier'],['range','HP range + modifier']];
export function hitPointDefaults(){return {hpMode:'fixed',hitDice:'1d8',hpRangeMin:1,hpRangeMax:4,hpRangeModifier:0,lessThanOneHitDie:false};}
export function diceParts(text){const m=String(text).trim().match(/^(\d{1,3})d(\d{1,4})([+-]\d{1,5})?$/i);if(!m||+m[1]<1||+m[1]>100||+m[2]<2||+m[2]>1000)return null;return {count:+m[1],sides:+m[2],bonus:+(m[3]||0)};}
const randomIndex=(random,size)=>Math.floor(Math.min(.999999999,Math.max(0,random()))*size);
export function rollDice(text,random=Math.random){const p=diceParts(text);if(!p)throw Error('Invalid dice expression: '+text);let value=p.bonus;for(let i=0;i<p.count;i++)value+=1+randomIndex(random,p.sides);return Math.max(1,value);}
export function migrateHitPoints(d,combat){
 // Average was deterministic; preserve its result as fixed HP instead of rerolling it.
 if(combat.hpMode==='average'){
  const p=diceParts(combat.hitDice);
  if(!p)throw Error('Cannot convert average HP: invalid Hit Dice.');
  d.stats.hp=Math.max(1,Math.floor(p.count*(p.sides+1)/2+p.bonus));combat.hpMode='fixed';
 }
}
export function hitPointIssues(stats,combat){
 const errors=[],integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!HIT_POINT_MODES.some(([mode])=>mode===combat.hpMode))errors.push('Choose one HP mode.');
 if(combat.hpMode==='fixed'&&!integer(stats.hp,1,1000000))errors.push('Fixed HP must be a whole number from 1 to 1,000,000.');
 if(combat.hpMode==='roll'&&!diceParts(combat.hitDice))errors.push('Hit Dice require 1–100 dice, 2–1,000 sides and an integer modifier from −99,999 to +99,999.');
 if(combat.hpMode==='range'){
  if(!integer(combat.hpRangeMin,1,1000000)||!integer(combat.hpRangeMax,1,1000000)||combat.hpRangeMin>combat.hpRangeMax)errors.push('HP range must have whole-number bounds from 1 to 1,000,000, with minimum ≤ maximum.');
  if(!integer(combat.hpRangeModifier,-99999,99999))errors.push('HP range modifier must be an integer from −99,999 to +99,999.');
 }
 if(typeof combat.lessThanOneHitDie!=='boolean')errors.push('Less than 1 Hit Die must be checked or unchecked.');
 return errors;
}
export function generateHitPoints(stats,combat,random=Math.random){
 const issues=hitPointIssues(stats,combat);if(issues.length)throw Error(issues.join('\n'));
 if(combat.hpMode==='fixed')return stats.hp;
 if(combat.hpMode==='roll')return rollDice(combat.hitDice,random);
 return Math.max(1,combat.hpRangeMin+randomIndex(random,combat.hpRangeMax-combat.hpRangeMin+1)+combat.hpRangeModifier);
}
const signed=n=>n?` ${n>0?'+':'−'} ${Math.abs(n)}`:'';
export function hitPointSummary(stats,combat){
 const issues=hitPointIssues(stats,combat);if(issues.length)return issues.join(' ');
 if(combat.hpMode==='fixed')return `${stats.hp} HP per MOB.`;
 const p=diceParts(combat.hitDice),low=combat.hpMode==='roll'?p.count+p.bonus:combat.hpRangeMin+combat.hpRangeModifier;
 const high=combat.hpMode==='roll'?p.count*p.sides+p.bonus:combat.hpRangeMax+combat.hpRangeModifier;
 const rule=combat.hpMode==='roll'?`${p.count}d${p.sides}${signed(p.bonus)}`:`${combat.hpRangeMin}–${combat.hpRangeMax}${signed(combat.hpRangeModifier)}`;
 return `${Math.max(1,low)}–${Math.max(1,high)} HP per MOB (${rule}).`;
}
export function workshopHitDice(combat){
 // Preserve existing HD metadata for ordinary fixed/range MOBs; do not infer HD from current HP.
 return {lessThanOneHitDie:combat.lessThanOneHitDie,hitDiceValue:combat.lessThanOneHitDie ? 0.5 : (diceParts(combat.hitDice)?.count??1),
  hitDiceLabel:combat.lessThanOneHitDie?'Less than 1 HD':diceParts(combat.hitDice)?combat.hitDice:'1 HD'};
}

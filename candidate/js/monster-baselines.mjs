// Numeric reference data verified against the user's 1994 Monstrous Manual.
export const MONSTER_BASELINES=Object.freeze({
 orc:{id:'orc',name:'Orc',hitDice:'1d8',hitDiceValue:1,thaco:19,attacksPerRound:1,ac:10,move:12,morale:11,xpValue:15,printedPage:281,pdfPage:284,typicalAc:6,typicalMove:9},
 kobold:{id:'kobold',name:'Kobold',hitDice:'1d4',hitDiceValue:0.5,thaco:20,attacksPerRound:1,ac:10,move:6,morale:9,xpValue:7,printedPage:214,pdfPage:217,typicalAc:7,typicalMove:6}
});
export function monsterBaseline(rules,species){
 const id=rules.monsterBaseline||'auto';
 if(id==='authored')return null;
 const key=id==='auto'?String(species||'').trim().toLowerCase():id;
 const result=MONSTER_BASELINES[key];
 if(!result)throw Error('No verified Monstrous Manual baseline for this species. Select Orc/Kobold or explicitly choose authored monster statistics.');
 return result;
}
export function hasNoClass(g){
 if(!g)return true;
 if(g.kind==='unique')return !g.fixed?.classId||g.fixed.classId==='none';
 return !g.classLevels?.length||g.classLevels.some(r=>r.weight>0&&r.classId==='none');
}

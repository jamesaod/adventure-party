// AD&D 2E PHB: equipment p.69, AC table 46 p.75, encumbrance pp.76–78.
const rows=[
 ['padded','Padded','padded',4,10,8],['leather','Leather','leather',5,15,8],
 ['studded-leather','Studded Leather','studded',20,25,7],['ring-mail','Ring Mail','ring',100,30,7],
 ['brigandine','Brigandine','brigandine',120,35,6],['scale-mail','Scale Mail','scale',120,40,6],
 ['hide','Hide','hide',15,30,6],['chain-mail','Chain Mail','chain',75,40,5],
 ['splint-mail','Splint Mail','splint',80,40,4],['banded-mail','Banded Mail','banded',200,35,4],
 ['bronze-plate-mail','Bronze Plate Mail','bronze-plate',400,45,4],['plate-mail','Plate Mail','plate',600,50,3],
 ['field-plate','Field Plate','field-plate',2000,60,2],['full-plate','Full Plate','full-plate','4,000–10,000',70,1]
];
export const ARMOR_ITEMS=Object.fromEntries(rows.map(([id,name,catalogArmorId,cost,encumbrance,baseArmorClass])=>[id,{
 id,name,category:'armor',slot:'armor',rules:{catalogArmorId,cost:`${cost} gp`,encumbrance,baseArmorClass,acModifier:baseArmorClass-10,
 movementRule:'phb-specific-encumbrance',movementNotes:'No fixed speed cap. Strength and total carried weight determine movement. Weight shown is Medium armor; Small ×0.5, Large ×1.5.'},
 physical:{authoredSize:null,status:'Rules entry; no 3D armor model.'},appearance:null
}]));
export const ARMOR_ENGINE_CATALOG=Object.fromEntries(Object.values(ARMOR_ITEMS).map(i=>[i.rules.catalogArmorId,{id:i.rules.catalogArmorId,name:i.name,slot:'armor',...i.rules}]));
// Table 48 columns correspond to movement rates 12 down to 1. Null = unavailable rate.
const bands=[
 [2,6,[1,null,2,null,null,3,null,null,4,null,null,5]],
 [3,10,[5,null,6,null,7,null,8,null,null,9,null,null]],
 [5,25,[10,11,12,13,14,15,16,17,18,19,20,21]],
 [7,55,[20,23,26,29,32,35,38,41,44,47,50,53]],
 [9,90,[35,40,45,50,55,60,65,70,75,80,85,89]],
 [11,110,[40,46,52,58,64,70,76,82,88,94,100,106]],
 [13,140,[45,53,61,69,77,85,93,101,109,117,125,133]],
 [15,170,[55,65,75,85,95,105,115,125,135,145,155,165]],
 [16,195,[70,80,90,100,110,120,130,140,150,160,170,180]],
 [17,220,[85,97,109,121,133,145,157,169,181,193,205,217]],
 [18,255,[110,123,136,149,162,175,188,201,214,227,240,253]]
];
const exceptional=[[50,280,135],[75,305,160],[90,330,185],[99,380,235],[100,480,335]];
export function encumberedMovement({strength=10,exceptionalStrength=0,weight=0,baseMove=12}={}){
 let band=bands.find(b=>strength<=b[0]),extension=false;
 if(strength===18&&exceptionalStrength>0){const [,max,start]=exceptional.find(b=>exceptionalStrength<=b[0])||exceptional.at(-1);band=[18,max,Array.from({length:12},(_,i)=>start+13*i)];}
 // Table 48 omits these scores. Extend between Table 1 allowance and maximum.
 if(strength<=1||strength>18){const capacities={1:[1,3],19:[485,640],20:[535,700],21:[635,810],22:[785,970],23:[935,1130],24:[1235,1440],25:[1535,1750]};const [start,max]=capacities[Math.max(1,Math.min(25,Math.round(strength)))];band=[strength,max,Array.from({length:12},(_,i)=>start+(max-start)*i/12)];extension=true;}
 const [,maximum,limits]=band;let column=limits.findIndex(limit=>limit!==null&&weight<=limit);if(column<0)column=11;
 const move=weight>maximum?0:baseMove<=0?0:Math.max(1,Math.floor(baseMove*(12-column)/12));
 return {move,weight,maximum,unencumberedLimit:limits[0],extension};
}
export function inventoryMovement(unit,lookup=()=>null){
 const baseMove=unit.authoredMove??unit.unencumberedMove??unit.move??12;
 let weight=Number.isFinite(unit.clothingWeightLb)?Math.max(0,unit.clothingWeightLb):5;
 const missingWeights=[];
 for(const item of unit.inventory||[]){
  const base=lookup(item)||{};let pounds=item.encumbrance??base.encumbrance;
  if(!Number.isFinite(pounds)){missingWeights.push(item.name||item.catalogItemId||'Unknown item');continue;}
  if(item.slot==='armor')pounds*=({small:.5,large:1.5}[String(item.armorSize||unit.sizeCategory||'medium').toLowerCase()]||1);
  // Legacy ammunition weights are per dozen; explicitly authored weights are per item.
  if(item.type==='Ammo'&&item.encumbrance==null)pounds/=12;
  weight+=Math.max(0,pounds)*Math.max(0,item.qty??item.quantity??1);
 }
 return {...encumberedMovement({strength:unit.stats?.str??unit.abilities?.str??10,exceptionalStrength:unit.exceptionalStrength||0,weight,baseMove}),baseMove,missingWeights};
}

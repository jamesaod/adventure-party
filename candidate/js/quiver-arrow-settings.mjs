// Quiver presentation only. Ammunition and the drawn/projectile arrow keep their own rules.
export function normalizeQuiverArrows(value={}){
 const widthPercent=value.widthPercent??40,count=value.count??4,spacingPercent=value.spacingPercent??100;
 const position=value.position??[0,0,0],rotation=value.rotation??[0,0,0];
 if(!Number.isFinite(widthPercent)||widthPercent<5||widthPercent>100||!Number.isInteger(count)||count<0||count>30||
    !Number.isFinite(spacingPercent)||spacingPercent<0||spacingPercent>300||
    ![position,rotation].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||position.some(v=>Math.abs(v)>1))
  throw Error('Quiver arrows need width 5–100%, count 0–30, spacing 0–300%, and valid bundle offsets.');
 return {widthPercent,count,spacingPercent,position:[...position],rotation:[...rotation]};
}

// Concentric hexagonal rings keep a stable, compact bundle as the count changes.
export function quiverArrowOffset(index,spacingPercent){
 if(index===0)return [0,0,0];
 let ring=1,first=1;
 while(index>=first+6*ring){first+=6*ring;ring++;}
 const side=Math.floor((index-first)/ring),step=(index-first)%ring,a=side*Math.PI/3,b=(side+1)*Math.PI/3;
 const gap=.0175*spacingPercent/100;
 return [((ring-step)*Math.cos(a)+step*Math.cos(b))*gap,-.0125+index%3*.004,
  ((ring-step)*Math.sin(a)+step*Math.sin(b))*gap];
}

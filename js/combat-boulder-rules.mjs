// Hill giant boulder house rules. Distances are tactical hexes (10 feet each).
export const BOULDER_RULES=Object.freeze({maxRange:10,rollHexes:2,damage:'2d8',release:.43,pickup:.65,speed:.5});
export function boulderRange(distance){return distance<=3?{band:'SHORT',penalty:0}:distance<=6?{band:'MEDIUM',penalty:-2}:distance<=10?{band:'LONG',penalty:-5}:{band:'OUT',penalty:null};}
export function boulderSaveDamage(rolled,saved){return saved?0:Math.floor(rolled/2);}
export function boulderScatter(target,directions,valid,random=Math.random){const cells=directions.map(d=>({x:target.x+d.x,y:target.y+d.y})).filter(valid);return cells.length?cells[Math.min(cells.length-1,Math.floor(random()*cells.length))]:{...target};}
export function boulderRollCells(origin,impact,directions){const dx=impact.x-origin.x,dy=impact.y-origin.y;let best=directions[0],score=-Infinity;for(const d of directions){const s=(dx+dy*.5)*(d.x+d.y*.5)+dy*d.y*.75;if(s>score){score=s;best=d;}}return [1,2].map(n=>({x:impact.x+best.x*n,y:impact.y+best.y*n}));}

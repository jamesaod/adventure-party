// Keep reduced cover detail briefly after camera motion to avoid quality flicker.
export function createCameraMotionBudget(holdMs=180){
 let previous=null,until=-Infinity;
 return {update(view,now){const next=[...view.matrix,view.zoom,view.anchor.x,view.anchor.y,view.width,view.height];
  if(previous&&next.some((v,i)=>Math.abs(v-previous[i])>1e-7))until=now+holdMs;
  previous=next;return now<until;
 },reset(){previous=null;until=-Infinity;}};
}

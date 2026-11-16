// Lighting clearance is measured from the combat prism's rendered surface.
export const COMBAT_TORCH_LIGHT_WALL_DISTANCE_METRES=.3048;
export function combatTorchLightPlacement(placement,terrain,style,depth=style.tacticalWallThickness,hexWidth=64,hexRow=31.5){
 const cell=style.cellMetres,squash=terrain.cellH/terrain.cellW;
 const original=terrain.project(placement.x/cell,placement.z/cell);
 let world=original;
 if(placement.attached){
  const plane=terrain.project(placement.wallX/cell,placement.wallZ/cell);
  const clearance=COMBAT_TORCH_LIGHT_WALL_DISTANCE_METRES/cell*terrain.cellW+depth/2;
  world={x:plane.x-placement.dx*clearance,y:plane.y-placement.dz*clearance*squash};
 }
 const authored={x:placement.x+(world.x-original.x)/terrain.cellW*cell,y:placement.y,z:placement.z+(world.y-original.y)/terrain.cellH*cell};
 return {world,point:authored,hex:{x:world.x/hexWidth-world.y/(2*hexRow),y:world.y/hexRow}};
}

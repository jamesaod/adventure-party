import {TREE_COLLISION_DATA} from './tree-collision-data.mjs';
import {BROADLEAF_FAMILIES,broadleafForVariant} from './broadleaf-family.mjs?v=sweet-birch1';
export function treeCollision(base,season,angle=0){
 const family=broadleafForVariant(base),id=Object.keys(BROADLEAF_FAMILIES).find(id=>BROADLEAF_FAMILIES[id]===family);
 if(!id)throw new RangeError('Unknown tree collision asset '+base);
 const asset=TREE_COLLISION_DATA[id][season==='spring'?'summer':season];if(!asset)throw new RangeError('Unknown tree season '+season);
 const step=Math.PI/12,nearest=Math.round(angle/step);if(Math.abs(angle-nearest*step)>1e-5)throw new RangeError('Unsupported tree collision orientation '+angle);
 return {canopyRadius:asset.canopyRadius,capsules:asset.poses[(nearest%24+24)%24]};
}

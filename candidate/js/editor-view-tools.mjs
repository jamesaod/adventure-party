import {CITY_WALL_TEXTURES,CITY_WOOD_FLOOR,CITY_FLOOR_TEXTURES} from './city-materials.mjs';
export const VIEW_TOOLS=Object.freeze({environment:'indoor',floor:'ground-stone',ceiling:'ceiling-stone',ambient:'ambient',wall:'edge-wall',construction:'edge-wall',objects:'edge-door'});
export const OBJECT_TOOLS=Object.freeze([['edge-door','Door'],['edge-window','Window'],['torch','Wall sconce'],['start','Party start'],['encounter-area','Encounter area'],['entrance','Entrance'],['exit','Exit connection']]);
export function eraseTool(view,curve=false){return ({environment:'indoor',floor:'ground-auto',ceiling:'ceiling-auto',ambient:'ambient-default',wall:curve?'curve-erase':'edge-erase',construction:'floor',objects:'object-erase'})[view];}
export function texturePreview(view,tool,material='stone'){
 const root='assets/textures/exploration/';
 if(view==='floor'&&CITY_FLOOR_TEXTURES[tool.slice(7)])return CITY_FLOOR_TEXTURES[tool.slice(7)];
 if((view==='wall'||view==='construction')&&CITY_WALL_TEXTURES[material])return CITY_WALL_TEXTURES[material];
 if(view==='floor')return {name:tool==='ground-grass'?'Grass':tool==='ground-dirt'?'Dirt path':'Stone floor',src:root+(tool==='ground-grass'?'grass-short-v1.png':tool==='ground-dirt'?'dirt-path-v1.png':'floor.png')};
 if(view==='wall'||view==='construction')return {name:material==='wood'?'Timber planks':'Stone wall',src:root+(material==='wood'?'wood-wall.png':'wall.png')};
 if(view==='ceiling')return {name:tool==='ceiling-wood'?'Wood ceiling':'Stone ceiling',src:root+(tool==='ceiling-wood'?'wood-ceiling.png':'wall.png')};
 if(view==='objects'&&tool==='edge-door')return {name:'Wooden door',src:root+'door.png'};
 return {name:({environment:'Indoor / outdoor',ambient:'Ambient light',objects:'Map object'})[view],src:null};
}

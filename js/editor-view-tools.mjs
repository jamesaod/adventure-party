export const VIEW_TOOLS=Object.freeze({environment:'indoor',floor:'ground-stone',ceiling:'ceiling-stone',ambient:'ambient',wall:'edge-wall',objects:'edge-door'});
export const OBJECT_TOOLS=Object.freeze([['edge-door','Door'],['edge-window','Window'],['torch','Wall sconce'],['start','Party start'],['encounter-area','Encounter area'],['entrance','Entrance'],['exit','Exit connection']]);
export function eraseTool(view,curve=false){return ({environment:'indoor',floor:'ground-auto',ceiling:'ceiling-auto',ambient:'ambient-default',wall:curve?'curve-erase':'edge-erase',objects:'object-erase'})[view];}
export function texturePreview(view,tool,material='stone'){
 const root='assets/textures/exploration/';
 if(view==='floor')return {name:tool==='ground-grass'?'Grass':tool==='ground-dirt'?'Dirt path':'Stone floor',src:root+(tool==='ground-grass'?'grass-short-v1.png':tool==='ground-dirt'?'dirt-path-v1.png':'floor.png')};
 if(view==='wall')return {name:material==='wood'?'Timber planks':'Stone wall',src:root+(material==='wood'?'wood-wall.png':'wall.png')};
 if(view==='ceiling')return {name:tool==='ceiling-wood'?'Wood ceiling':'Stone ceiling',src:root+(tool==='ceiling-wood'?'wood-ceiling.png':'wall.png')};
 if(view==='objects'&&tool==='edge-door')return {name:'Wooden door',src:root+'door.png'};
 return {name:({environment:'Indoor / outdoor',ambient:'Ambient light',objects:'Map object'})[view],src:null};
}

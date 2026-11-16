// Add assets here; the palette, validation, export and renderer consume stable IDs.
export const TEXTURES=Object.freeze([
 {id:'grass',name:'Grass',src:'assets/textures/exploration/grass-short-v1.png'},
 {id:'dirt',name:'Dirt',src:'assets/textures/exploration/dirt-path-v1.png'},
 {id:'stone',name:'Stone',src:'assets/textures/exploration/floor.png'},
 {id:'forest_leaves_02',name:'Forest Leaves 02',src:'assets/textures/polyhaven/forest_leaves_02.jpg'},
 {id:'grass_ground',name:'Grass Ground',src:'assets/textures/polyhaven/grass_ground.jpg'},
 {id:'forest_ground_06',name:'Forest Ground 06',src:'assets/textures/polyhaven/forest_ground_06.jpg'},
 {id:'rocky_terrain_02',name:'Rocky Terrain 02',src:'assets/textures/polyhaven/rocky_terrain_02.jpg'},
 {id:'forrest_ground_01',name:'Forest Ground 01',src:'assets/textures/polyhaven/forrest_ground_01.jpg'},
 {id:'mud_cracked_dry_riverbed_002',name:'Cracked Dry Riverbed',src:'assets/textures/polyhaven/mud_cracked_dry_riverbed_002.jpg'},
 {id:'dry_river_pebbles',name:'Dry River Pebbles',src:'assets/textures/polyhaven/dry_river_pebbles.jpg'}
]);
export const TREES=Object.freeze(Array.from({length:5},(_,i)=>({id:`fir-0${i+1}`,name:`Fir ${i+1}`,atlasRow:i,model:`assets/terrain/treeit-firs/models/fir-0${i+1}.gltf?v=R238C436`})));
export const TREE_ATLAS='assets/terrain/treeit-firs/fir-body-atlas.png?v=R238C436';

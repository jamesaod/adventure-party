// Shared IDs preserve independent wall faces and authored geometry.
export const CITY_WALL_TEXTURES={
 'red-brick':{name:'City Red Brick',src:'assets/textures/exploration/city-wall-red-brick-v1.png',color:'#a96750'},
 'beige-stone':{name:'City Beige Stone',src:'assets/textures/exploration/city-wall-beige-stone-v1.png',color:'#c5b393'}
};
export const WALL_MATERIAL_IDS=['stone','wood',...Object.keys(CITY_WALL_TEXTURES)];
export const CITY_WOOD_FLOOR='assets/textures/exploration/city-wood-floor-v1.png';

export const CITY_FLOOR_TEXTURES={
 wood:{name:'City Wood Floor',src:CITY_WOOD_FLOOR},
 'gray-stone':{name:'City Gray Stone Floor',src:'assets/textures/exploration/city-gray-stone-floor-v1.png'},
 'gray-flagstone':{name:'City Gray Flagstone Floor',src:'assets/textures/exploration/city-gray-flagstone-floor-v1.png'}
};

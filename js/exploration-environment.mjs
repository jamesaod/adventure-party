export const OUTDOOR_AMBIENT=Object.freeze({sky:0xc7deff,ground:0x8b8971,intensity:2.4});
export function isOutdoor(map,x,z){return map.environment?.[z]?.[x]==='o';}
export function validateEnvironment(map){
 if(map.environment!==undefined&&(!Array.isArray(map.environment)||map.environment.length!==map.height||map.environment.some(row=>typeof row!=='string'||row.length!==map.width||/[^io]/.test(row))))throw Error('Environment must contain one indoor/outdoor marker per square.');
}
export function paintEnvironment(map,x,z,outdoor){
 if(map.grid[z]?.[x]!=='.'&&map.grid[z]?.[x]!=='D')throw Error('Paint indoor/outdoor on floor squares.');
 const rows=map.environment?[...map.environment]:Array.from({length:map.height},()=> 'i'.repeat(map.width));
 rows[z]=rows[z].slice(0,x)+(outdoor?'o':'i')+rows[z].slice(x+1);map.environment=rows;
}

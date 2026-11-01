export const OUTDOOR_AMBIENT=Object.freeze({sky:0xc7deff,ground:0x8b8971,intensity:2.4});
export function isOutdoor(map,x,z){return map.environment?.[z]?.[x]==='o';}
export function ambientLightAt(map,x,z){return map.ambientLight?.[z]?.[x]??(isOutdoor(map,x,z)?100:0);}
export function paintAmbientLight(map,x,z,value){
 if(!['.','D'].includes(map.grid[z]?.[x]))throw Error('Paint ambient light on floor squares.');
 if(value!==null&&(!Number.isInteger(value)||value<0||value>100))throw Error('Ambient light must be 0–100%.');
 const rows=map.ambientLight?map.ambientLight.map(row=>[...row]):Array.from({length:map.height},()=>Array(map.width).fill(null));rows[z][x]=value;map.ambientLight=rows;
}
export function validateEnvironment(map){
 if(map.ambientLight!==undefined&&(!Array.isArray(map.ambientLight)||map.ambientLight.length!==map.height||map.ambientLight.some(row=>!Array.isArray(row)||row.length!==map.width||row.some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>100)))))throw Error('Ambient light must contain one 0–100% value or default marker per square.');
 if(map.environment!==undefined&&(!Array.isArray(map.environment)||map.environment.length!==map.height||map.environment.some(row=>typeof row!=='string'||row.length!==map.width||/[^io]/.test(row))))throw Error('Environment must contain one indoor/outdoor marker per square.');
}
export function paintEnvironment(map,x,z,outdoor){
 if(map.grid[z]?.[x]!=='.'&&map.grid[z]?.[x]!=='D')throw Error('Paint indoor/outdoor on floor squares.');
 const rows=map.environment?[...map.environment]:Array.from({length:map.height},()=> 'i'.repeat(map.width));
 rows[z]=rows[z].slice(0,x)+(outdoor?'o':'i')+rows[z].slice(x+1);map.environment=rows;
}

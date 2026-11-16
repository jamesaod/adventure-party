export const MAX_LEVEL=6,FEET_PER_LEVEL=2.5,HEIGHT_PER_LEVEL=Math.sqrt(3)*32*FEET_PER_LEVEL/10;
export const levelAt=(map,q,r)=>map.terrain.elevations?.[r]?.[q]??0;
export function setLevel(map,q,r,level){if(!Number.isInteger(level)||level<0||level>MAX_LEVEL)throw Error('Elevation must be a whole level from 0 to 6.');map.terrain.elevations??=Array.from({length:map.grid.height},()=>Array(map.grid.width).fill(0));map.terrain.elevations[r][q]=level;}
export function validateElevations(rows,width,height){if(rows===undefined)return;if(!Array.isArray(rows)||rows.length!==height||rows.some(row=>!Array.isArray(row)||row.length!==width||row.some(z=>!Number.isInteger(z)||z<0||z>MAX_LEVEL)))throw Error('Elevations must match the map and contain whole levels from 0 to 6 (2.5 feet each).');}

import {CANOPY_GRASS_DEFAULTS,grassLabSettings} from './grass-presets.mjs?v=foliage-restored1';
import {COMBAT_STREAM_PATH,traceStream} from './combat-stream-field.mjs?v=R238C455';
// Versioned presentation settings, deliberately independent of saved combat maps.
export const DEFAULTS=Object.freeze({canopyEnabled:false,snowPress:true,streamEnabled:true,streamWidth:3.2,streamDepth:.65,streamLevel:-.16,streamSpeed:.25,streamRipple:.3,streamPath:COMBAT_STREAM_PATH,"hour":11,"ambient":300,"rain":0,"snow":0,"cloudiness":0,"wind":0,"flakes":true,"snowPaused":false,"performance":true,"grass":true,"rocks":true,"sticks":true,"height":0.4,"width":2.3,"spread":1.2,"bend":0.9,"tufts":2,"grassWind":1.8,"brightness":0.85,"dry":0.82,"grassColor":"#ffffff","outlineOpacity":0.83,"outlineWidth":0.75,"outlineColor":"#060e04","antialiasing":2,...grassLabSettings(CANOPY_GRASS_DEFAULTS)});
const limits={streamWidth:[1,8],streamDepth:[.25,1.2],streamLevel:[-.6,-.02],streamSpeed:[0,2],streamRipple:[0,1],hour:[0,23.833333],ambient:[0,300],rain:[0,1],snow:[0,1],cloudiness:[0,1],wind:[0,1],height:[.1,2],width:[.2,4],spread:[.1,2],bend:[0,3],tufts:[1,5],grassWind:[0,3],brightness:[.1,2],dry:[0,1],outlineOpacity:[0,1],outlineWidth:[0,1.5],antialiasing:[0,8]};
export function validateSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Settings must be an object.');
 const result={...DEFAULTS};
 for(const [key,value] of Object.entries(input)){
  if(!Object.hasOwn(DEFAULTS,key))throw Error('Unknown setting: '+key);
  if(key==='streamPath'){traceStream(value);result[key]=value.map(({x,y})=>({x,y}));continue;}
  if(typeof value!==typeof DEFAULTS[key])throw Error('Invalid '+key);
  if(limits[key]&&(!Number.isFinite(value)||value<limits[key][0]||value>limits[key][1]))throw Error('Out of range: '+key);
  if(key.endsWith('Color')&&!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid color: '+key);
  if(key==='antialiasing'&&![0,2,4,8].includes(value))throw Error('Invalid antialiasing');
  if(key==='tufts'&&!Number.isInteger(value))throw Error('Tufts must be an integer');
  result[key]=value;
 }
 return result;
}
export function exportPreset(settings){return {format:'adventure-party-terrain-look',version:1,exportedAt:new Date().toISOString(),settings:validateSettings(settings)};}
export function importPreset(data){if(data?.format!=='adventure-party-terrain-look'||data.version!==1)throw Error('Unsupported terrain preset format or version.');return validateSettings(data.settings);}
export const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);

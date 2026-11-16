// Unit presentation preference, independent of combat simulation and saves.
let requested=2,levels=[0,2,4,8];
const listeners=new Set();
export function unitAntialiasing(){return {requested,levels:[...levels],samples:levels.filter(n=>n<=requested).at(-1)??0};}
function notify(){for(const listener of listeners)listener(unitAntialiasing());}
export function setUnitAntialiasing(samples){requested=[0,2,4,8].includes(Number(samples))?Number(samples):2;notify();}
export function configureUnitAntialiasing(colorSamples,depthSamples){
 levels=[0,...[2,4,8].filter(n=>colorSamples.includes(n)&&depthSamples.includes(n))];notify();
}
export function observeUnitAntialiasing(listener){listeners.add(listener);listener(unitAntialiasing());return ()=>listeners.delete(listener);}

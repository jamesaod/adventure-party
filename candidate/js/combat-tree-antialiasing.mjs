// Tree presentation preference, independent of combat simulation and saves.
let requested=2,levels=[0,2,4,8];
const listeners=new Set();
export function treeAntialiasing(){return {requested,levels:[...levels],samples:levels.filter(n=>n<=requested).at(-1)??0};}
function notify(){for(const listener of listeners)listener(treeAntialiasing());}
export function setTreeAntialiasing(samples){requested=2;notify();}
export function configureTreeAntialiasing(colorSamples,depthSamples){
 levels=[0,...[2,4,8].filter(n=>colorSamples.includes(n)&&depthSamples.includes(n))];notify();
}
export function observeTreeAntialiasing(listener){listeners.add(listener);listener(treeAntialiasing());return ()=>listeners.delete(listener);}

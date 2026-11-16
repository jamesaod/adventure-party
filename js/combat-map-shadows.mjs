import * as T from '../assets/vendor/three/three.module.min.js';
import {center,contains,atPoint,RADIUS} from './combat-map-document.mjs';
import {levelAt,HEIGHT_PER_LEVEL} from './combat-map-elevation.mjs';
import {hexPoints,shadowVector,hull} from './combat-map-detail-rules.mjs';
import {TREES} from './combat-map-palette.mjs';
export function createMapShadows(atlas){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;const bounds=new T.Vector4();
 const masks=TREES.map(t=>{const c=document.createElement('canvas');c.width=384;c.height=512;const x=c.getContext('2d');x.drawImage(atlas,0,t.atlasRow*512,384,512,0,0,384,512);x.globalCompositeOperation='source-in';x.fillStyle='#000';x.fillRect(0,0,384,512);return c;});
 const polygon=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
 function rebuild(map,sun){const end=center(map.grid.width-1,map.grid.height-1),left=-RADIUS,top=-RADIUS,w=center(map.grid.width-1,Math.min(1,map.grid.height-1)).x+2*RADIUS,h=end.y+2*RADIUS;bounds.set(left,top,w,h);const scale=Math.min(2,1536/Math.max(w,h));canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);ctx.setTransform(canvas.width/w,0,0,canvas.height/h,-left*canvas.width/w,-top*canvas.height/h);ctx.fillStyle='#000';const light=shadowVector(sun);if(!light){texture.needsUpdate=true;return;}
 // Spatially index projected silhouettes by receiver hex. Rebuilt only on edits or sun changes.
 const buckets=new Map();function add(item,points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minY=Math.min(...ys)-32,maxY=Math.max(...ys)+32,minX=Math.min(...xs)-32,maxX=Math.max(...xs)+32;for(let r=Math.max(0,Math.floor(minY/48));r<=Math.min(map.grid.height-1,Math.ceil(maxY/48));r++)for(let q=Math.max(0,Math.floor(minX/(Math.sqrt(3)*32)-(r&1)/2));q<=Math.min(map.grid.width-1,Math.ceil(maxX/(Math.sqrt(3)*32)-(r&1)/2));q++){const key=q+','+r;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}}
 for(let r=0;r<map.grid.height;r++)for(let q=0;q<map.grid.width;q++){const height=levelAt(map,q,r)*HEIGHT_PER_LEVEL;if(!height)continue;const points=hexPoints(q,r);add({points,height},[...points,...points.map(p=>({x:p.x+light.x*height,y:p.y+light.y*height}))]);}
 for(const tree of map.objects){const c=center(tree.q,tree.r),height=levelAt(map,tree.q,tree.r)*HEIGHT_PER_LEVEL;add({tree,c,height},[{x:c.x-70,y:c.y-70},{x:c.x+70,y:c.y+70},{x:c.x+light.x*(height+112)-70,y:c.y+light.y*(height+112)-70},{x:c.x+light.x*(height+112)+70,y:c.y+light.y*(height+112)+70}]);}
 for(const [key,items]of buckets){const [q,r]=key.split(',').map(Number),receiver=levelAt(map,q,r)*HEIGHT_PER_LEVEL;ctx.save();polygon(hexPoints(q,r));ctx.clip();for(const item of items){const delta=item.height-receiver;if(item.points){if(delta<=.01)continue;polygon(hull([...item.points,...item.points.map(p=>({x:p.x+light.x*delta,y:p.y+light.y*delta}))]));ctx.fill();}else{if(delta+112<=0)continue;const length=Math.hypot(light.x,light.y),px=length?light.y/length:1,py=length?-light.x/length:0;ctx.save();ctx.transform(px*.25,py*.25,-light.x*.25,-light.y*.25,item.c.x-px*48+light.x*(112+delta),item.c.y-py*48+light.y*(112+delta));const bottom=Math.min(448,448+delta*4);if(bottom>0)ctx.drawImage(masks[TREES.findIndex(t=>t.id===item.tree.assetId)],0,0,384,bottom,0,0,384,bottom);ctx.restore();}}ctx.restore();}texture.needsUpdate=true;
 }
 return {texture,bounds,rebuild,dispose(){texture.dispose();}};
}

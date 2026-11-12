// One authored-space image field. Mirrored repetitions preserve matching boundary pixels.
export function streetV2Cell(x,z){return {x:((x%16)+16)%16,z:((z%16)+16)%16};}
let artwork=null,normal=null;
if(typeof Image!=='undefined'&&typeof document!=='undefined'){
 const image=new Image();image.src=new URL('../assets/textures/exploration/broken-city-streets-v2.png',import.meta.url).href;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;const c=canvas.getContext('2d',{willReadFrequently:true});
 for(let z=0;z<2;z++)for(let x=0;x<2;x++){c.save();c.translate(x?2048:0,z?2048:0);c.scale(x?-1:1,z?-1:1);c.drawImage(image,0,0,1024,1024);c.restore();}
 artwork=canvas;
}
function normalAtlas(){
 if(normal)return normal;const n=2048,c=artwork.getContext('2d'),pixels=c.getImageData(0,0,n,n),height=new Float32Array(n*n),stone=new Uint8Array(n*n),out=c.createImageData(n,n);
 // Keep the stone/dirt step separate from subtle face texture: no broad bevel blur.
 for(let i=0;i<height.length;i++){const k=i*4,r=pixels.data[k],g=pixels.data[k+1],b=pixels.data[k+2];stone[i]=r-b<46?1:0;height[i]=(r+g+b)/765;}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const left=z*n+(x+n-1)%n,right=z*n+(x+1)%n,up=((z+n-1)%n)*n+x,down=((z+1)%n)*n+x;
  // A narrow, near-horizontal normal represents the nearly vertical riser.
  // Face imperfections stay gentle instead of becoming sharp noise everywhere.
  const dx=(stone[right]-stone[left])*16+(height[right]-height[left])*.30;
  const dz=(stone[down]-stone[up])*16+(height[down]-height[up])*.30;
  const len=Math.hypot(dx,dz,1),k=(z*n+x)*4;
  out.data[k]=127.5*(1-dx/len);out.data[k+1]=127.5*(1+dz/len);out.data[k+2]=127.5*(1+1/len);out.data[k+3]=255;
 }
 normal=document.createElement('canvas');normal.width=normal.height=n;normal.getContext('2d').putImageData(out,0,0);return normal;
}
export function paintStreetV2(ctx,x,z,size,{normal=false}={}){if(!artwork)throw Error('City street artwork is not loaded');const cell=streetV2Cell(x,z);ctx.drawImage(normal?normalAtlas():artwork,cell.x*128,cell.z*128,128,128,0,0,size,size);}

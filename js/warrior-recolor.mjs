/**
 * Woman Warrior v1 appearance experiment. The Tripo GLB has one material and
 * one packed texture. Build two conservative UV masks directly from its mesh,
 * avoiding any edits to the original binary and any model-specific renderer.
 * The estimated regions remain visual-QA candidates, not hand-approved masks.
 */
export const WARRIOR_RECOLOR_ID='woman-warrior-hair-metal-v2';
export const HAIR_PRESETS=Object.freeze({
  default:null,black:[38,30,30],brown:[82,50,35],auburn:[160,70,42],
  blonde:[202,156,80],silver:[190,188,184],white:[224,220,212]
});
export const METAL_PRESETS=Object.freeze({
  default:null,steel:[137,151,164],dark:[70,75,81],silver:[205,205,208],
  bronze:[154,105,61],brass:[185,149,67],gold:[216,169,69]
});
export const DEBUG_MODES=Object.freeze(['off','hair','metal']);
export function normalizeWarriorRecolor(value={}){
  return {
    hair:Object.prototype.hasOwnProperty.call(HAIR_PRESETS,value?.hair)?value.hair:'default',
    metal:Object.prototype.hasOwnProperty.call(METAL_PRESETS,value?.metal)?value.metal:'default',
    debug:DEBUG_MODES.includes(value?.debug)?value.debug:'off'
  };
}
export function isWarriorRecolorModel(modelId){
  return modelId==='woman-warrior-tripo-source'||modelId==='woman-warrior-mixamo-sword-shield-full-17';
}
function textureSource(texture){
  const image=texture?.image||texture?.source?.data;
  return image&&Number.isFinite(image.width)&&Number.isFinite(image.height)&&image.width>0?image:null;
}
function candidateMask(geometry,w,h){
  const uv=geometry.getAttribute('uv'),position=geometry.getAttribute('position'),index=geometry.index;
  if(!uv||!position)return null;
  const masks=['hair','metal'].map(()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
  const contexts=masks.map(c=>c.getContext('2d',{willReadFrequently:true}));
  contexts.forEach(ctx=>{ctx.fillStyle='#fff';});
  const count=index?index.count:position.count;
  for(let i=0;i+2<count;i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    const x=(position.getX(a)+position.getX(b)+position.getX(c))/3;
    const y=(position.getY(a)+position.getY(b)+position.getY(c))/3;
    const z=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;
    // Geometry-first *candidate* regions, deliberately shown through a debug
    // overlay before they can be treated as confirmed hair or armor surfaces.
    // Hair curls extend well below the helmet, especially at the back.
    const hair=y>.57&&y<.945&&Math.abs(x)>.085&&Math.abs(x)<.34&&z<.085;
    const metal=(y>.42&&y<.82&&Math.abs(x)<.28)||
      (y>.10&&y<.47&&Math.abs(x)<.20)||
      (y>.67&&y<.83&&Math.abs(x)>.24);
    if(!hair&&!metal)continue;
    const u=[uv.getX(a),uv.getX(b),uv.getX(c)];
    const v=[uv.getY(a),uv.getY(b),uv.getY(c)];
    if(Math.max(...u)-Math.min(...u)>.35||Math.max(...v)-Math.min(...v)>.35)continue;
    const paint=ctx=>{
      ctx.beginPath();ctx.moveTo(u[0]*(w-1),(1-v[0])*(h-1));
      ctx.lineTo(u[1]*(w-1),(1-v[1])*(h-1));
      ctx.lineTo(u[2]*(w-1),(1-v[2])*(h-1));ctx.closePath();ctx.fill();
    };
    if(hair)paint(contexts[0]);
    if(metal)paint(contexts[1]);
  }
  return contexts.map(ctx=>ctx.getImageData(0,0,w,h).data);
}
const originals=new WeakMap();
function recoloredTexture(THREE,mesh,material,colors){
  const source=textureSource(material.map);
  if(!source)return null;
  const width=source.width,height=source.height;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(source,0,0,width,height);
  const pixels=ctx.getImageData(0,0,width,height);
  const masks=candidateMask(mesh.geometry,width,height);
  if(!masks)return null;
  const d=pixels.data,hair=masks[0],metal=masks[1];
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const hr=r>35&&r<190&&r>g*1.16&&g>b*.95&&r-g>12&&(r+g+b)/3<135;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    const mt=max-min<65&&max>85&&(r+g+b)/3<235;
    if(colors.debug==='hair'&&hair[i+3]>0) {d[i]=255;d[i+1]=0;d[i+2]=255;continue;}
    if(colors.debug==='metal'&&metal[i+3]>0) {d[i]=0;d[i+1]=255;d[i+2]=255;continue;}
    if(colors.debug!=='off') continue;
    const target=colors.hair!=='default'&&hair[i+3]>0&&hr ? HAIR_PRESETS[colors.hair]
      : colors.metal!=='default'&&metal[i+3]>0&&mt ? METAL_PRESETS[colors.metal] : null;
    if(!target)continue;
    const lum=.2126*r+.7152*g+.0722*b;
    const strength=target===HAIR_PRESETS[colors.hair]?.valueOf()? .82:.76;
    const mul=.45+.75*lum/145;
    for(let j=0;j<3;j++) d[i+j]=Math.round(d[i+j]*(1-strength)+
      Math.min(255,target[j]*mul)*strength);
  }
  ctx.putImageData(pixels,0,0);
  const result=new THREE.CanvasTexture(canvas);
  result.flipY=material.map.flipY;
  result.colorSpace=material.map.colorSpace;
  result.wrapS=material.map.wrapS;result.wrapT=material.map.wrapT;
  result.magFilter=material.map.magFilter;result.minFilter=material.map.minFilter;
  result.anisotropy=material.map.anisotropy;
  result.needsUpdate=true;
  return result;
}
export function applyWarriorRecolor(THREE,model,settings={}){
  if(!model)return 0;
  const colors=normalizeWarriorRecolor(settings);
  let state=originals.get(model);
  if(!state){
    state=[];
    model.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.geometry?.getAttribute('uv'))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      for(let i=0;i<materials.length;i++){
        if(!textureSource(materials[i]?.map))continue;
        state.push({mesh,index:i,base:materials[i],current:null});
      }
    });
    originals.set(model,state);
  }
  for(const entry of state){
    const {mesh,index,base}=entry;
    const changed=entry.current;
    const recolor=colors.hair!=='default'||colors.metal!=='default'||colors.debug!=='off';
    let material=base;
    if(recolor){
      const replacement=recoloredTexture(THREE,mesh,base,colors);
      if(replacement){
        material=base.clone();material.map=replacement;material.needsUpdate=true;
      }
    }
    if(Array.isArray(mesh.material)){
      const arr=mesh.material.slice();arr[index]=material;mesh.material=arr;
    }else mesh.material=material;
    if(changed&&changed!==base){
      changed.map?.dispose();
      changed.dispose();
    }
    entry.current=material===base?null:material;
  }
  return state.length;
}

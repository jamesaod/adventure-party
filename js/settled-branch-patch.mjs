import * as T from '../assets/vendor/three/three.module.min.js';
// Baked once per specimen/limb, reused for every fall. No frame-time readback.
export const DEBRIS_PATCH_SEGMENTS=8,DEBRIS_FLATTEN=.12;
export function debrisPatchGeometry(box,pixels,size){
 const width=box.max.x-box.min.x,depth=box.max.z-box.min.z,height=box.max.y-box.min.y;
 const g=new T.PlaneGeometry(width,depth,DEBRIS_PATCH_SEGMENTS,DEBRIS_PATCH_SEGMENTS);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const x=Math.min(size-1,Math.round(uv.getX(i)*(size-1))),y=Math.min(size-1,Math.round(uv.getY(i)*(size-1)));p.setXYZ(i,p.getX(i)+(box.min.x+box.max.x)/2,pixels[(y*size+x)*4]/255*height*DEBRIS_FLATTEN,p.getZ(i)+(box.min.z+box.max.z)/2);}
 g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function bakeDebrisPatch(renderer,mesh,rest,size=256){
 const source=new T.Mesh(mesh.geometry);source.quaternion.copy(rest.end);source.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(source);box.min.x-=1;box.max.x+=1;box.min.z-=1;box.max.z+=1;
 const h=Math.max(.001,box.max.y-box.min.y),center=box.getCenter(new T.Vector3());
 const camera=new T.OrthographicCamera(box.min.x-center.x,box.max.x-center.x,(box.max.z-box.min.z)/2,-(box.max.z-box.min.z)/2,.1,h+20);
 camera.position.set(center.x,box.max.y+10,center.z);camera.up.set(0,0,-1);camera.lookAt(center.x,box.min.y,center.z);camera.updateMatrixWorld();
 const scene=new T.Scene();scene.add(source);const target=new T.WebGLRenderTarget(size,size);target.texture.colorSpace=T.SRGBColorSpace;
 const originals=[mesh.material].flat(),materials=originals.map(m=>new T.MeshBasicMaterial({map:m.map,color:m.color,alphaMap:m.alphaMap,alphaTest:m.alphaTest,side:T.DoubleSide}));source.material=Array.isArray(mesh.material)?materials:materials[0];
 const saved={target:renderer.getRenderTarget(),color:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha(),tone:renderer.toneMapping,auto:renderer.autoClear};
 const color=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4);
 const heightMaterial=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{low:{value:box.min.y},span:{value:h}},vertexShader:'varying float altitude;void main(){vec4 p=modelMatrix*vec4(position,1.);altitude=p.y;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying float altitude;uniform float low,span;void main(){float h=clamp((altitude-low)/span,0.,1.);gl_FragColor=vec4(h,h,h,1.);}'});
 try{renderer.toneMapping=T.NoToneMapping;renderer.autoClear=true;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,color);source.material=heightMaterial;target.dispose();target.texture.colorSpace=T.NoColorSpace;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,height);}
 finally{renderer.setRenderTarget(saved.target);renderer.setClearColor(saved.color,saved.alpha);renderer.toneMapping=saved.tone;renderer.autoClear=saved.auto;target.dispose();heightMaterial.dispose();materials.forEach(m=>m.dispose());}
 const map=new T.DataTexture(color,size,size);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 const relief=new T.DataTexture(height,size,size);relief.magFilter=relief.minFilter=T.LinearFilter;relief.needsUpdate=true;
 const patch=new T.Mesh(debrisPatchGeometry(box,height,size),new T.MeshStandardMaterial({map,bumpMap:relief,bumpScale:h*DEBRIS_FLATTEN,roughness:1,alphaTest:.15,side:T.DoubleSide}));
 patch.name='Settled_branch_patch';patch.userData.debrisPatch=true;patch.visible=false;patch.receiveShadow=true;patch.castShadow=false;patch.frustumCulled=false;
 return patch;
}

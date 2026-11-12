import * as THREE from '../assets/vendor/three/three.module.min.js';

// Display-RGB matches the original Canvas artwork. No tone mapping or sRGB
// conversion: preserve the authored palette, additive glows and 75% body.
export function createFireballEffect(renderer){
 const scene=new THREE.Scene(),camera=new THREE.Camera();
 const viewport={value:new THREE.Vector2(1,1)};
 const makeTarget=()=>new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
 const body=makeTarget(),scratch=makeTarget(),wide=makeTarget(),narrow=makeTarget();
 const geometry=new THREE.BufferGeometry();let capacity=0;
 const material=new THREE.ShaderMaterial({uniforms:{viewport},side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:`attribute vec2 corner;attribute vec4 tint;attribute float roundShape;
 varying vec2 p;varying vec4 color;varying float shape;uniform vec2 viewport;
 void main(){p=corner;color=tint;shape=roundShape;gl_Position=vec4(position.x/viewport.x*2.-1.,1.-position.y/viewport.y*2.,0.,1.);}`,
 fragmentShader:`varying vec2 p;varying vec4 color;varying float shape;
 void main(){float coverage=1.;if(shape>.5){float d=length(p);coverage=1.-smoothstep(1.-fwidth(d),1.,d);}
 if(coverage<=0.)discard;gl_FragColor=vec4(color.rgb,color.a*coverage);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 const quad=new THREE.PlaneGeometry(2,2);
 const blurMaterial=new THREE.ShaderMaterial({uniforms:{image:{value:null},direction:{value:new THREE.Vector2()},sigma:{value:1}},depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D image;uniform vec2 direction;uniform float sigma;varying vec2 uv0;
 void main(){vec4 sum=vec4(0.);float weights=0.;for(int i=-16;i<=16;i++){float x=float(i)*sigma*3./16.;float w=exp(-.5*x*x/(sigma*sigma));sum+=texture2D(image,uv0+direction*x)*w;weights+=w;}gl_FragColor=sum/weights;}`});
 const blur=new THREE.Mesh(quad,blurMaterial);blur.frustumCulled=false;
 const uniforms={image:{value:body.texture},viewport,anchor:{value:new THREE.Vector2()},zoom:{value:1},opacity:{value:1},light:{value:new THREE.Vector3()},fade:{value:1},radial:{value:false}};
 const compositeMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:`uniform vec2 viewport,anchor;uniform float zoom;varying vec2 uv0;varying vec2 pixel;
 void main(){uv0=uv;pixel=vec2(uv.x,1.-uv.y)*viewport;vec2 p=anchor+(pixel-anchor)*zoom;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}`,
 fragmentShader:`uniform sampler2D image;uniform float opacity,fade;uniform vec3 light;uniform bool radial;varying vec2 uv0;varying vec2 pixel;
 void main(){if(!radial){gl_FragColor=texture2D(image,uv0)*opacity;return;}
 float d=length(pixel-light.xy)/light.z;if(d>1.)discard;
 vec4 a=vec4(255.,118.,30.,.48),b=vec4(238.,61.,12.,.34),c=vec4(183.,31.,8.,.19),e=vec4(119.,15.,5.,.075),f=vec4(82.,8.,3.,0.);
 // Canvas gradients interpolate premultiplied colors.
 a.rgb=a.rgb/255.*a.a;b.rgb=b.rgb/255.*b.a;c.rgb=c.rgb/255.*c.a;e.rgb=e.rgb/255.*e.a;f.rgb*=0.;
 vec4 v=d<.30?mix(a,b,d/.30):d<.64?mix(b,c,(d-.30)/.34):d<.88?mix(c,e,(d-.64)/.24):mix(e,f,(d-.88)/.12);
 gl_FragColor=v*fade;}`});
 const composite=new THREE.Mesh(quad,compositeMaterial);composite.frustumCulled=false;
 function paint(object){scene.add(object);renderer.render(scene,camera);scene.remove(object);}
 function shapes(items){
  const count=items.length*6;if(count>capacity){capacity=Math.ceil(count/1024)*1024;geometry.dispose();
   geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('corner',new THREE.BufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('tint',new THREE.BufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('roundShape',new THREE.BufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
  }
  let n=0;for(const [x,y,rx,ry,r,g,b,a,round] of items)for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]){
   geometry.attributes.position.setXYZ(n,x+u*rx,y+v*ry,0);geometry.attributes.corner.setXY(n,u,v);
   geometry.attributes.tint.setXYZW(n,r/255,g/255,b/255,a);geometry.attributes.roundShape.setX(n,round);n++;
  }
  geometry.setDrawRange(0,count);for(const attr of Object.values(geometry.attributes))attr.needsUpdate=true;
  if(count)paint(mesh);
 }
 function soften(output,sigma){
  blurMaterial.uniforms.sigma.value=sigma;blurMaterial.uniforms.image.value=body.texture;
  blurMaterial.uniforms.direction.value.set(1/body.width,0);renderer.setRenderTarget(scratch);renderer.clear();paint(blur);
  blurMaterial.uniforms.image.value=scratch.texture;blurMaterial.uniforms.direction.value.set(0,1/body.height);
  renderer.setRenderTarget(output);renderer.clear();paint(blur);
 }
 return {
  draw(data,view){
   const previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
   try{
    viewport.value.set(view.width,view.height);for(const target of [body,scratch,wide,narrow])if(target.width!==view.width||target.height!==view.height)target.setSize(view.width,view.height);
    renderer.setClearColor(0,0);renderer.setRenderTarget(body);renderer.clear();shapes(data.lobes);
    soften(wide,16);soften(narrow,7);renderer.setRenderTarget(previous);
    uniforms.anchor.value.set(view.anchor.x,view.anchor.y);uniforms.zoom.value=view.zoom;
    compositeMaterial.blending=THREE.AdditiveBlending;uniforms.fade.value=data.fade;uniforms.light.value.fromArray(data.light);uniforms.radial.value=true;paint(composite);
    uniforms.radial.value=false;uniforms.image.value=wide.texture;uniforms.opacity.value=.34*data.fade;paint(composite);
    uniforms.image.value=narrow.texture;uniforms.opacity.value=.30*data.fade;paint(composite);
    compositeMaterial.blending=THREE.NormalBlending;uniforms.image.value=body.texture;uniforms.opacity.value=data.opacity;paint(composite);
    // Grain and sparks are authored in the same unzoomed pixel space as body.
    renderer.setRenderTarget(body);renderer.clear();shapes(data.particles);renderer.setRenderTarget(previous);
    uniforms.opacity.value=1;paint(composite);
   }finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);}
  },
  dispose(){for(const target of [body,scratch,wide,narrow])target.dispose();geometry.dispose();quad.dispose();material.dispose();blurMaterial.dispose();compositeMaterial.dispose();}
 };
}


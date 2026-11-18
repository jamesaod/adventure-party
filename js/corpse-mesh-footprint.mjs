// Rasterize the posed body's ground projection once; no per-frame work.
export function axialHexAt(x,z,spacing){const r=z/(spacing*Math.sqrt(3)/2),q=x/spacing-r/2;let a=Math.round(q),b=Math.round(r),c=Math.round(-q-r);const da=Math.abs(a-q),db=Math.abs(b-r),dc=Math.abs(c+q+r);if(da>db&&da>dc)a=-b-c;else if(db>dc)b=-a-c;return {x:a,y:b};}
export function footprintFromTriangles(triangles,{spacing=1.524,resolution=.045,minArea=.012,centerRadius=Infinity,minCoreArea=0,details=false,boundary=false}={}){
 const pixels=new Set(),counts=new Map();
 for(const [a,b,c] of triangles){const area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);if(Math.abs(area)<1e-10)continue;
  const minX=Math.floor(Math.min(a.x,b.x,c.x)/resolution),maxX=Math.floor(Math.max(a.x,b.x,c.x)/resolution),minZ=Math.floor(Math.min(a.z,b.z,c.z)/resolution),maxZ=Math.floor(Math.max(a.z,b.z,c.z)/resolution);
  for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){const id=ix+','+iz;if(pixels.has(id))continue;const x=(ix+.5)*resolution,z=(iz+.5)*resolution;
   const u=((b.x-x)*(c.z-z)-(b.z-z)*(c.x-x))/area,v=((c.x-x)*(a.z-z)-(c.z-z)*(a.x-x))/area,w=1-u-v;if(u<0||v<0||w<0)continue;
   pixels.add(id);const h=axialHexAt(x,z,spacing),key=h.x+','+h.y,entry=counts.get(key)||{...h,samples:0,core:0};entry.samples++;const cx=spacing*(h.x+h.y*.5),cz=spacing*Math.sqrt(3)/2*h.y;if(Math.hypot(x-cx,z-cz)<=centerRadius)entry.core++;counts.set(key,entry);
  }
 }
 if(boundary){const out=[];for(const id of pixels){const [x,z]=id.split(',').map(Number);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!pixels.has((x+dx)+','+(z+dz)))out.push({x:(x+.5+dx*.5)*resolution,z:(z+.5+dz*.5)*resolution,nx:dx,nz:dz});}return out;}
 const cells=[...counts.values()].map(c=>({...c,area:c.samples*resolution*resolution,coreArea:c.core*resolution*resolution}));return details?cells:cells.filter(c=>c.area>=minArea&&c.coreArea>=minCoreArea).map(({x,y})=>({x,y}));
}
export function sampleCorpseMeshFootprint(unit,THREE,options){
 unit.root.updateMatrixWorld(true);const triangles=[],p=new THREE.Vector3();
 unit.model.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;for(let parent=mesh;parent;parent=parent.parent)if(!parent.visible||parent.name==='StudioRightHandEquipment'||parent.name==='StudioLeftHandShield')return;
  mesh.skeleton?.update();const vertices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);vertices.push({x:p.x-unit.root.position.x,z:p.z-unit.root.position.z});}
  const index=mesh.geometry.index,count=index?.count||vertices.length;for(let i=0;i+2<count;i+=3)triangles.push([vertices[index?index.getX(i):i],vertices[index?index.getX(i+1):i+1],vertices[index?index.getX(i+2):i+2]]);
 });return footprintFromTriangles(triangles,options);
}

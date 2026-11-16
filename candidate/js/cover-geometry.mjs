// Share only byte-equivalent Float32 vertex records; preserve every triangle and attribute seam.
export function indexCoverGeometry(geometry,THREE){
 const attributes=Object.entries(geometry.attributes),unique=new Map(),indices=[],source=[];
 const count=geometry.attributes.position.count;
 for(let i=0;i<count;i++){
  const record=[];for(const [,a] of attributes)for(let k=0;k<a.itemSize;k++)record.push(a.array[i*a.itemSize+k]);
  const key=record.join(',');let index=unique.get(key);if(index===undefined){index=source.length;unique.set(key,index);source.push(i);}indices.push(index);
 }
 if(source.length===count)return geometry;
 for(const [name,a] of attributes){const packed=new a.array.constructor(source.length*a.itemSize);for(let i=0;i<source.length;i++)for(let k=0;k<a.itemSize;k++)packed[i*a.itemSize+k]=a.array[source[i]*a.itemSize+k];geometry.setAttribute(name,new THREE.BufferAttribute(packed,a.itemSize,a.normalized));}
 geometry.setIndex(indices);return geometry;
}

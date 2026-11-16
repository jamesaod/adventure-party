import * as THREE from '../assets/vendor/three/three.module.min.js';
const geometries = new WeakMap();
export const shadowGeometryFor = geometry => geometries.get(geometry) || geometry;
export const registerShadowGeometry = (geometry, shadow) => geometries.set(geometry, shadow);

// Bake the registered shadow LOD in exactly the same final pose as its body.
// A lightweight proxy lets skin weights come from the LOD, without swapping the
// live rig's geometry or changing the shared skeleton/bind matrices.
export function captureShadowGeometry(mesh,matrix){
 const source=shadowGeometryFor(mesh.geometry);if(source===mesh.geometry)return null;
 const result=source.clone(),position=result.attributes.position,p=new THREE.Vector3();
 const proxy=mesh.isSkinnedMesh?new THREE.SkinnedMesh(source,mesh.material):new THREE.Mesh(source,mesh.material);
 if(mesh.isSkinnedMesh){proxy.skeleton=mesh.skeleton;proxy.bindMatrix.copy(mesh.bindMatrix);proxy.bindMatrixInverse.copy(mesh.bindMatrixInverse);}
 for(let i=0;i<position.count;i++){proxy.getVertexPosition(i,p).applyMatrix4(matrix);position.setXYZ(i,p.x,p.y,p.z);}
 result.deleteAttribute('skinIndex');result.deleteAttribute('skinWeight');result.morphAttributes={};result.computeBoundingSphere();return result;
}

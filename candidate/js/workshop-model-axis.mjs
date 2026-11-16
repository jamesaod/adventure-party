export const MODEL_UP_AXES=['Y','Z','X','-Y','-Z','-X'];
export function applyModelUpAxis(THREE,group,axis='Y'){
 if(!MODEL_UP_AXES.includes(axis))throw Error('Invalid model up axis.');
 const direction=new THREE.Vector3();direction[axis.slice(-1).toLowerCase()]=axis.startsWith('-')?-1:1;
 group.quaternion.setFromUnitVectors(direction,new THREE.Vector3(0,1,0));
}

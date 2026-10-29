import {CAMERA_ELEVATION} from './studio-core.mjs?v=R238C99';
// Same normalized rest-body framing as Studio; never fit equipment or each pose.
export function repositoryRestFrame(min,max,aspect){
 const low=Math.min(0,min[1]),high=Math.max(0,max[1]);
 const radius=Math.max(...[min[0],max[0]].flatMap(x=>[min[2],max[2]].map(z=>Math.hypot(x,z))));
 const projected=(high-low)*Math.cos(CAMERA_ELEVATION)+2*radius*Math.sin(CAMERA_ELEVATION);
 const frameHeight=Math.max(projected,2*radius/aspect,1)*1.24;
 return {center:[0,(high+low)/2,0],frameHeight};
}

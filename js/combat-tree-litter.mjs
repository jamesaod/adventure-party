import {isBroadleaf} from './broadleaf-family.mjs?v=sweet-birch1';
// Two-triangle leaf cluster extracted from WhiteOak_LeafFall.spm's native export.
const OAK_LEAF_POSITIONS=[[0.04469074999999994,0.010586719725,0.177089575],[-0.0902297500000001,0.008,-0.177089575],[0.17779774999999992,0.0110451375,-0.0016422249999999917],[-0.0902297500000001,0.008,-0.177089575],[0.04469074999999994,0.010586719725,0.177089575],[-0.17779774999999992,0.0120078925,0.13003412499999997]];
const OAK_LEAF_UVS=[[0.716527,-0.000241859],[0.785559,0.28342],[0.554418,0.108282],[0.785559,0.28342],[0.716527,-0.000241859],[0.921392,0.0656419]];
export function leafScatter(face,zones,tuning,hash,contains){
 const unit=face.grassUnit||128/3,squash=face.grassSquash||.568329,step=unit*.22,sy=step*squash,points=face.points,out=[];
 if(!face.grass||face.snowEligible<=0)return out;
 const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
 for(const t of zones){if(!isBroadleaf(t))continue;const radius=t.radius*1.25;
 if(t.x-radius*t.width>right||t.x+radius*t.width<left||t.y-radius*t.row>bottom||t.y+radius*t.row<top)continue;
 for(let gx=Math.floor(Math.max(left,t.x-radius*t.width)/step);gx<=Math.floor(Math.min(right,t.x+radius*t.width)/step);gx++)for(let gy=Math.floor(Math.max(top,t.y-radius*t.row)/sy);gy<=Math.floor(Math.min(bottom,t.y+radius*t.row)/sy);gy++){
 const x=(gx+hash(gx,gy,201))*step,y=(gy+hash(gx,gy,202))*sy,r=(y-t.y)/t.row,q=(x-t.x)/t.width-r/2,d=Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))/radius;
 const edge=Math.max(0,Math.min(1,(1-d)/.35)),density=.72*edge*edge*(3-2*edge);
 if(d>=1||hash(gx,gy,203)>density||!contains(points,x,y)||tuning.groundWater?.(x,y,unit,squash)>.02)continue;
 out.push({x,y,unit,squash,groundElevation:tuning.groundElevation?.(x,y,unit,squash)||0,seed:hash(gx,gy,204),type:t.species==='sweet-birch'?7:t.species==='american-beech'?6:t.species==='sugar-maple'?5:4,field:0,key:'leaf:'+t.species+':'+gx+','+gy});
 }}return out;
}

// Individual maple leaf: same 13 cm card and full texture as the particle asset.
export const MAPLE_LEAF_POSITIONS=[[-.065,.008,-.065],[.065,.008,-.065],[.065,.008,.065],[-.065,.008,-.065],[.065,.008,.065],[-.065,.008,.065]];
export const LEAF_POSITIONS=OAK_LEAF_POSITIONS;
export const MAPLE_LEAF_UVS=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
export const LEAF_UVS=OAK_LEAF_UVS;

// Same portrait 13 cm card as the Beech particle, without stretching its leaf.
export const BEECH_LEAF_POSITIONS=MAPLE_LEAF_POSITIONS.map(([x,y,z])=>[x*911/1726,y,z]);

// Same 13 cm portrait card and artwork as the native birch leaf cluster.
export const BIRCH_LEAF_POSITIONS=MAPLE_LEAF_POSITIONS.map(([x,y,z])=>[x*1086/1448,y,z]);

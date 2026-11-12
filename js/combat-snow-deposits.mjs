// A bounded batch of real deposited grains. No spatial noise/coverage pattern.
export const SNOW_GRAIN_MASS=.18;
export const SNOW_GRAIN_INTEGRAL=2.3;
export function createSnowDepositBatch(limit=32768){
 const positions=new Float32Array(limit*3),coats=new Float32Array(limit*2);let credit=0;
 return {positions,coats,
  clear(){credit=0;},
  add(amount,area,texelArea){credit+=Math.max(0,amount)*Math.max(0,area)/Math.max(1e-8,texelArea)/SNOW_GRAIN_INTEGRAL;},
  take(spawn,landed=[],random=Math.random,deposit=null){
   const wanted=Math.min(limit,Math.floor(credit));let count=0;
   for(;count<wanted;count++){
    let p=landed.length?{...landed.pop(),landed:true}:spawn(random);if(!p)break;if(deposit)p=deposit(p,random);if(!p)break;
    positions[count*3]=p.x;positions[count*3+1]=p.y;positions[count*3+2]=p.size||4.2+random()*2.8;coats[count*2]=p.brush||0;coats[count*2+1]=p.layer||0;
   }
   credit-=count;return count;
  },get pending(){return credit;}
 };
}

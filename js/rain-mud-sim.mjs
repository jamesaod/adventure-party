export const SIZE=16,N=81,STEP=SIZE/(N-1);
export function sheltered(x,z){return x>2&&x<6&&z>2&&z<6;}
export function materialAt(x){return x < -2.7?'grass':x>2.7?'stone':'soil';}
export class WetGround {
 constructor({allGrass=false}={}){this.allGrass=allGrass;this.shelterEnabled=true;this.base=new Float32Array(N*N);this.wet=new Float32Array(N*N);this.water=new Float32Array(N*N);this.dent=new Float32Array(N*N);this.reset();}
 reset(){this.wet.fill(0);this.water.fill(0);this.dent.fill(0);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=i*STEP-8,z=j*STEP-8;this.base[j*N+i]=-.16*Math.exp(-((x-.4)**2+(z+2)**2)/3)+.015*Math.sin(x*1.4)*Math.cos(z);}}
 index(x,z){return Math.max(0,Math.min(N-1,Math.round((z+8)/STEP)))*N+Math.max(0,Math.min(N-1,Math.round((x+8)/STEP)));}
 height(x,z){const k=this.index(x,z);return this.base[k]+this.dent[k];}
 step(dt,{rain,drying}){
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const k=j*N+i,x=i*STEP-8,z=j*STEP-8,stone=!this.allGrass&&materialAt(x)==='stone',fall=this.shelterEnabled&&sheltered(x,z)?0:rain;
   this.wet[k]=Math.max(0,Math.min(1,this.wet[k]+dt*(fall*.12-drying*.025)));
   this.water[k]=Math.max(0,this.water[k]+dt*(fall*.008*(stone?1:this.wet[k]**3)-drying*.0015-(stone?0:.001*(1-this.wet[k]))));
  }
  // Pairwise conservative flow. No per-droplet physics; surface updates at 10 Hz.
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const a=j*N+i;for(const b of [i+1<N?a+1:-1,j+1<N?a+N:-1]){if(b<0)continue;
    const delta=(this.base[a]+this.dent[a]+this.water[a])-(this.base[b]+this.dent[b]+this.water[b]);
    const from=delta>0?a:b,to=delta>0?b:a,amount=Math.min(this.water[from]*.24,Math.abs(delta)*dt*.7);
    this.water[from]-=amount;this.water[to]+=amount;
   }
   if(i===0||j===0||i===N-1||j===N-1)this.water[a]*=Math.exp(-dt*2);
  }
 }
 stamp(x,z,heading,softness){
  if(!this.allGrass&&materialAt(x)==='stone')return;
  const depth=.065*softness*this.wet[this.index(x,z)]**2,c=Math.cos(heading),s=Math.sin(heading);
  for(let j=Math.max(0,Math.floor((z+7.5)/STEP));j<=Math.min(N-1,Math.ceil((z+8.5)/STEP));j++)for(let i=Math.max(0,Math.floor((x+7.5)/STEP));i<=Math.min(N-1,Math.ceil((x+8.5)/STEP));i++){
   const dx=i*STEP-8-x,dz=j*STEP-8-z,u=(dx*c-dz*s)/.15,v=(dx*s+dz*c)/.29,q=Math.sqrt(u*u+v*v),k=j*N+i;
   if(!this.allGrass&&materialAt(i*STEP-8)==='stone')continue;
   if(q<1)this.dent[k]=Math.max(-.12,this.dent[k]-depth*(1-q*q));
   else if(q<1.5)this.dent[k]=Math.min(.025,this.dent[k]+depth*.12*(1-(q-1)*2));
  }
 }
}

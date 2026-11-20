// Metres, +Y up. State survives ground -> hand -> flight -> ground.
export function boulderHoleDepth(h,x,z){if(h.rut){const a=h.rut,dx=a.x1-a.x0,dz=a.z1-a.z0,t=Math.max(0,Math.min(1,((x-a.x0)*dx+(z-a.z0)*dz)/(dx*dx+dz*dz||1))),r2=((x-a.x0-dx*t)**2+(z-a.z0-dz*t)**2)/(a.radius*a.radius);return r2<1?h.depth*(1-r2)**2:0;}if(h.profile){const q=h.profile,u=(x-h.x)/h.rx*.5+.5,v=(z-h.z)/h.rz*.5+.5;if(u<0||v<0||u>1||v>1)return 0;const a=u*(q.n-1),b=v*(q.n-1),i=Math.min(q.n-2,Math.floor(a)),j=Math.min(q.n-2,Math.floor(b)),s=a-i,t=b-j;return (q.data[j*q.n+i]*(1-s)+q.data[j*q.n+i+1]*s)*(1-t)+(q.data[(j+1)*q.n+i]*(1-s)+q.data[(j+1)*q.n+i+1]*s)*t;}const r2=((x-h.x)/h.rx)**2+((z-h.z)/h.rz)**2;return r2<1?h.depth*(1-r2)**2:0;}
export function exposedDepth(holes,x,z){return holes.reduce((d,h)=>Math.max(d,boulderHoleDepth(h,x,z)),0);}
export function liftBoulder(rock,holes){if(rock.state!=='ground')return false;if(rock.buried>0){holes.push({id:rock.id+'-hole',x:rock.x,z:rock.z,profile:rock.profile,rx:rock.width*.5,rz:rock.depth*.5,depth:Math.min(.1524,rock.buried)});}rock.buried=0;rock.state='held';return true;}
export function throwBoulder(rock,origin,target,duration=1.5){if(rock.state!=='held')return false;rock.state='flight';rock.flight={origin:{...origin},target:{...target},duration,elapsed:0};return true;}
export function advanceBoulder(rock,dt){if(rock.state!=='flight')return false;const f=rock.flight;f.elapsed=Math.min(f.duration,f.elapsed+Math.max(0,dt));const t=f.elapsed/f.duration;rock.x=f.origin.x+(f.target.x-f.origin.x)*t;rock.z=f.origin.z+(f.target.z-f.origin.z)*t;rock.y=f.origin.y+(f.target.y-f.origin.y)*t+4*t*(1-t)*2.5;if(t>=1){rock.state='ground';rock.flight=null;}return true;}
export function boulderBlocks(rock,x,z,clearance=0){if(rock.state!=='ground')return false;return ((x-rock.x)/(rock.width*.5+clearance))**2+((z-rock.z)/(rock.depth*.5+clearance))**2<=1;}

export function beginBoulderRoll(rock,flight,holes){
 const dx=flight.target.x-flight.origin.x,dz=flight.target.z-flight.origin.z,len=Math.hypot(dx,dz)||1;
 const radius=Math.min(rock.width,rock.depth)*.36;
 const h={id:rock.id+'-rut-'+holes.length,x:rock.x,z:rock.z,rx:radius,rz:radius,depth:.10,rut:{x0:rock.x,z0:rock.z,x1:rock.x,z1:rock.z,radius}};
 holes.push(h);rock.state='rolling';rock.roll={dx:dx/len,dz:dz/len,speed:Math.min(3.5,Math.max(1.5,len/flight.duration*.55)),hole:h,distance:0};return h;
}
export function advanceBoulderRoll(rock,dt){
 if(rock.state!=='rolling')return 0;const r=rock.roll,step=Math.max(0,Math.min(dt,r.speed/1.35)),distance=Math.max(0,r.speed*step-.5*1.35*step*step);
 rock.x+=r.dx*distance;rock.z+=r.dz*distance;r.distance+=distance;r.speed=Math.max(0,r.speed-1.35*step);
 const h=r.hole,a=h.rut;a.x1=rock.x;a.z1=rock.z;h.x=(a.x0+a.x1)/2;h.z=(a.z0+a.z1)/2;h.rx=Math.abs(a.x1-a.x0)/2+a.radius;h.rz=Math.abs(a.z1-a.z0)/2+a.radius;
 if(r.speed<=.001){rock.state='ground';rock.roll=null;}return distance;
}

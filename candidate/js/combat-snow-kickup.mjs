const particles=[];
export function clearSnowKickup(){particles.length=0;}
export function kickSnow(x,y,depth,scale){
 if(depth<=.005)return;const count=Math.min(8,2+Math.ceil(depth*12));
 for(let i=0;i<count&&particles.length<256;i++){const a=Math.random()*Math.PI*2,speed=.15+Math.random()*.5;particles.push({x,y,h:depth*10,vx:Math.cos(a)*speed*scale[0],vy:Math.sin(a)*speed*scale[1],vh:3+Math.random()*5,age:0,life:.35+Math.random()*.35});}
}
export function updateSnowKickup(dt){let n=0;for(const p of particles){p.age+=dt;if(p.age>=p.life)continue;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vh-=22*dt;p.h=Math.max(0,p.h+p.vh*dt);particles[n++]=p;}particles.length=n;return particles;}

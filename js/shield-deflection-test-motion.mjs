export const canDeflect=({missBy=1,shield=true,front=true}={})=>(missBy===1||missBy===2)&&shield&&front;
export function sampleDeflection(time,{missBy=1,shield=true,front=true,loft=3.2,spins=2.5,side=1.3}={}){
 const incoming=.65,impact={x:-.74,y:1.25,z:0},g=5.8;
 const flight=(loft+Math.sqrt(loft*loft+2*g*(impact.y-.42)))/g;
 const end=incoming+flight,enabled=canDeflect({missBy,shield,front});
 if(time<incoming){const t=Math.max(0,time/incoming);return {x:-5+(impact.x+5)*t,y:impact.y+.12*Math.sin(t*Math.PI),z:0,angle:0,stage:'Incoming',end:enabled?end+.3:incoming+1.2};}
 if(!enabled){const t=Math.min(1,(time-incoming)/1.2);return {x:impact.x+4*t,y:Math.max(.04,1.25*(1-t)),z:.8*t,angle:-.25,stage:t<1?'Ordinary miss — no deflection':'Landed',end:incoming+1.2};}
 const t=Math.min(flight,Math.max(0,time-incoming)),angle=2*Math.PI*spins*t/flight;
 const settle=time>=end+.3?1:Math.min(1,Math.max(0,(time-end)/.3)),ease=settle*settle*(3-2*settle),rest=Math.round(angle/Math.PI)*Math.PI;
 return {x:impact.x-1.8*t,y:Math.max(.42,impact.y+loft*t-.5*g*t*t)*(1-ease)+.045*ease,z:side*t,angle:angle+(rest-angle)*ease,stage:time<end?(t<.12?'Shield impact':'Spinning deflection'):(settle<1?'Settling':'Landed'),end:end+.3};
}

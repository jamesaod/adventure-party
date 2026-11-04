// Geometric Sun at the spring equinox, 38 degrees north. Hours are local
// apparent solar time, not civil time; no longitude/DST/refraction model.
export const SOLAR_LATITUDE=38;
export const wrapHour=hour=>((Number(hour)%24)+24)%24;
export function solarState(hour=12){
 hour=wrapHour(hour);const latitude=SOLAR_LATITUDE*Math.PI/180,h=(hour-12)*Math.PI/12;
 const direction={x:-Math.sin(h),y:Math.cos(latitude)*Math.cos(h),z:Math.sin(latitude)*Math.cos(h)};
 const altitude=Math.asin(Math.max(-1,Math.min(1,direction.y)))*180/Math.PI;
 const azimuth=(Math.atan2(direction.x,-direction.z)*180/Math.PI+360)%360;
 const t=Math.max(0,Math.min(1,(altitude+6)/58)),sky=.025+.975*t*t*(3-2*t);
 return {hour,latitude:SOLAR_LATITUDE,direction,altitude,azimuth,sky,daylight:Math.max(0,Math.cos(h)),warmth:1-Math.max(0,Math.min(1,altitude/25)),phase:altitude>=-.00001?'day':altitude>=-6?'twilight':'night'};
}
export function hourFromPointer(x,y){return wrapHour((Math.atan2(y,x)+Math.PI/2)*12/Math.PI+12);}
const noonDirection=solarState(12).direction;
export function solarFaceGain(normal,sun){
 const dot=(a,b)=>Math.max(0,(a.x||0)*b.x+(a.y||0)*b.y+(a.z||0)*b.z),noon=noonDirection;
 return (.75+.25*dot(normal,sun.direction))/(.75+.25*dot(normal,noon));
}
const channels=c=>[c>>16&255,c>>8&255,c&255],blend=(a,b,t)=>a.map((v,i)=>Math.round(v*(1-t)+b[i]*t)).reduce((n,v)=>n*256+v,0);
// Artistic atmospheric palette, separate from geometric Sun and tactical LOS.
export function solarPalette(sun){
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const dawn=sun.hour<12,warm=(1-smooth(0,25,sun.altitude))*smooth(-10,0,sun.altitude),cool=1-smooth(-12,12,sun.altitude);
 const direct=dawn?[255,186,114]:[255,143,101];
 return {warm,cool,sun:[255,255,255].map((value,i)=>(value*(1-warm)+direct[i]*warm)/255),
   sky:dawn?[255,202,164]:[235,158,171],ground:dawn?[139,111,91]:[128,96,119]};
}
export function solarAmbient(base,sun){
 const palette=solarPalette(sun);
 const sky=blend(channels(base.sky),[115,139,197],palette.cool*.65),ground=blend(channels(base.ground),[64,77,111],palette.cool*.55);
 return {...base,intensity:base.intensity*sun.sky,
   sky:blend(channels(sky),palette.sky,palette.warm*.65),ground:blend(channels(ground),palette.ground,palette.warm*.5)};
}

export function solarTimeLabel(hour){const minutes=Math.round(wrapHour(hour)*60)%1440;return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}

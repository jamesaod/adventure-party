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
export function solarAmbient(base,sun){return {...base,intensity:base.intensity*sun.sky,sky:blend(channels(base.sky),[245,166,109],sun.warmth*.55),ground:blend(channels(base.ground),[118,86,76],sun.warmth*.35)};}
export function solarTimeLabel(hour){const minutes=Math.round(wrapHour(hour)*60)%1440;return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}

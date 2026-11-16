// Independent presentation layer. Does not grant LOS or change targeting rules.
export const DISTANCE_VISIBILITY=Object.freeze({startHex:7,step:.1,minimum:.2});
export function distanceDarkness(distance){return Math.min(1-DISTANCE_VISIBILITY.minimum,Math.max(0,(Math.floor(distance)-DISTANCE_VISIBILITY.startHex+1)*DISTANCE_VISIBILITY.step));}
export function tileDistanceVisibility(distance,ambientPercent=0,dynamicLight=0){
 const light=Math.min(1,Math.max(0,ambientPercent/100)+Math.max(0,dynamicLight));
 return Math.max(DISTANCE_VISIBILITY.minimum,Math.min(1,1-Math.max(0,distanceDarkness(distance)-light)));
}

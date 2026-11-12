// Tactical arrow proportions, shared by held geometry, flight and lodged arrows.
// The existing 16px arrow represents an 80cm shaft at the base battlefield scale.
export const ARROW_VISUAL=Object.freeze({
 lengthMetres:.8,pixelsPerMetre:20,shaftWidth:.85,
 featherWidth:1.25,featherStroke:.55,featherLength:4.3,featherStart:.7,
 headWidth:1.3,headLength:1.8,wood:'#704522',feather:'#d9cba8',head:'#66615a'
});
globalThis.AdventurePartyArrowVisual=ARROW_VISUAL;

// A model camera's scene units are not battlefield metres. Match the 16 logical
// pixel map arrow using the actual orthographic frame width, before view zoom.
export function arrowScaleForFrame(camera,width){
 const span=camera?.right-camera?.left;
 return Number.isFinite(span)&&span>0&&Number.isFinite(width)&&width>0
  ? ARROW_VISUAL.pixelsPerMetre*span/width : 1;
}

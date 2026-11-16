// Snap both crop edges to the final framebuffer grid, so offscreen samples
// composite one-to-one instead of changing scale as the camera moves.
export function modelPixelCrop(bounds,view,width,height){
 const sx=width/view.width,sy=height/view.height;
 const left=bounds?Math.max(0,Math.floor((view.anchor.x+(bounds.x-view.anchor.x)*view.zoom-3)*sx)):0;
 const top=bounds?Math.max(0,Math.floor((view.anchor.y+(bounds.y-view.anchor.y)*view.zoom-3)*sy)):0;
 const right=bounds?Math.min(width,Math.ceil((view.anchor.x+(bounds.x+bounds.width-view.anchor.x)*view.zoom+3)*sx)):width;
 const bottom=bounds?Math.min(height,Math.ceil((view.anchor.y+(bounds.y+bounds.height-view.anchor.y)*view.zoom+3)*sy)):height;
 return {crop:{x:left/sx,y:top/sy,width:(right-left)/sx,height:(bottom-top)/sy},targetWidth:right-left,targetHeight:bottom-top};
}

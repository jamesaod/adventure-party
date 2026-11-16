// Sequential passes are composited immediately; their images need no LRU retention.
// Keep one high-water scratch target, bounded by the largest cropped viewport.
// The camera projects the same crop across its full target, preserving UV alignment.
export function createTransientTarget(create){
 let target=null,width=0,height=0,samples=-1,allocations=0,hits=0;
 return {get(w,h,s){w=Math.ceil(w/32)*32;h=Math.ceil(h/32)*32;
  if(target&&samples===s&&w<=width&&h<=height){hits++;return target;}
  const nextWidth=Math.max(w,width),nextHeight=Math.max(h,height);
  if(target&&samples===s)target.setSize(nextWidth,nextHeight);
  else{target?.dispose();target=create(nextWidth,nextHeight,s);}
  width=nextWidth;height=nextHeight;samples=s;allocations++;return target;
 },stats:()=>({entries:target?1:0,width,height,samples,allocations,hits,bytes:target?width*height*8*(1+Math.max(0,samples)):0}),dispose(){target?.dispose();target=null;width=height=0;samples=-1;}};
}

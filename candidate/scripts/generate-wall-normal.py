"""Offline stone normal data, derived from the existing wall artwork.
Requires Pillow and NumPy only. Run from the repository root.
Joint guides constrain relief to masonry seams instead of treating every
photographic dark stain as a depression. Source color artwork is unchanged.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
SIZE=512
source=Image.open('assets/textures/exploration/wall.png').convert('RGB').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
light=np.asarray(source.convert('L'),dtype=np.float32)/255
mask=Image.new('L',(SIZE,SIZE));draw=ImageDraw.Draw(mask)
scale=SIZE/1254
# Broad guides around the actual photographed mortar, six uneven courses.
for y in [30,255,475,701,931,1125]:
 draw.line([(0,round(y*scale)),(SIZE,round(y*scale))],fill=255,width=round(42*scale))
for low,high,joints in [(30,255,[8,491,860]),(255,475,[220,760,1185]),(475,701,[80,420,1000]),(701,931,[190,740,1220]),(931,1125,[160,500,950]),(1125,1254,[335,650,1095])]:
 for x in joints:draw.line([(round(x*scale),round(low*scale)),(round(x*scale),round(high*scale))],fill=255,width=round(70*scale))
# Dark mortar near a guide, not arbitrary dark stones or moss elsewhere.
seams=((light<.35)&(np.asarray(mask)>0)).astype(np.uint8)*255
seams=Image.fromarray(seams).filter(ImageFilter.MaxFilter(3))
def blur_wrap(image,radius):
 tiled=Image.new('L',(SIZE*3,SIZE*3))
 for y in range(3):
  for x in range(3):tiled.paste(image,(x*SIZE,y*SIZE))
 return np.asarray(tiled.filter(ImageFilter.GaussianBlur(radius)).crop((SIZE,SIZE,SIZE*2,SIZE*2)),dtype=np.float32)/255
mortar=blur_wrap(seams,2.3)
gray=source.convert('L');fine=blur_wrap(gray,1.2)-blur_wrap(gray,4.5)
height=1-mortar*.8+fine*.12
# Tangent +Y follows texture V, which points upward relative to image rows.
dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*5
dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*5
normal=np.stack([-dx,dy,np.ones_like(dx)],axis=2)
normal/=np.linalg.norm(normal,axis=2,keepdims=True)
pixels=np.rint((normal*.5+.5)*255).clip(0,255).astype(np.uint8)
output=Path('assets/textures/exploration/wall-normal.png')
Image.fromarray(pixels).save(output,optimize=True)
print(str(output),output.stat().st_size,'bytes; source artwork unchanged')

"""Prepare encoded 256px maps without Blender linear/sRGB conversion."""
import json,sys
from pathlib import Path
from PIL import Image,ImageStat,ImageOps
root=Path(__file__).resolve().parents[1]
source,out=map(Path,sys.argv[1:3])
for item in json.loads((root/'data/equipment-imports-196.json').read_text(encoding='utf8'))['items']:
 dest=out/item['id'];dest.mkdir(parents=True,exist_ok=True);maps=item['textures'];refs={}
 def read(role):
  p=source/item['sourceKey']/maps[role];im=Image.open(p).convert('RGB');refs[role]={'sourceMean':ImageStat.Stat(im).mean,'sourceSize':im.size};return im.resize((256,256),Image.Resampling.LANCZOS)
 albedo=read('albedo');albedo.save(dest/'albedo.png');refs['albedo']['outputMean']=ImageStat.Stat(albedo).mean
 if maps['normal']:
  normal=read('normal')
  if 'directx' in maps['normal'].lower():
   r,g,b=normal.split();normal=Image.merge('RGB',(r,ImageOps.invert(g),b))
  normal.save(dest/'normal.png')
 if maps['packed']:packed=read('packed')
 else:
  r=Image.new('L',(256,256),255);g=read('roughness').getchannel('R') if maps['roughness'] else Image.new('L',(256,256),180);b=read('metallic').getchannel('R') if maps['metallic'] else Image.new('L',(256,256),0);packed=Image.merge('RGB',(r,g,b))
 packed.save(dest/'metallic-roughness.png');(dest/'reference.json').write_text(json.dumps(refs,indent=2),encoding='utf8')

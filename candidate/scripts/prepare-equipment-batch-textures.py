"""python scripts/prepare-equipment-batch-textures.py SOURCE_ROOT OUTPUT_ROOT [--reference]"""
from pathlib import Path
from PIL import Image,ImageStat
import hashlib,json,sys
root=Path(__file__).resolve().parents[1]
source,output=map(Path,sys.argv[1:3]);reference='--reference' in sys.argv[3:]
for item in json.loads((root/'data/equipment-imports-144.json').read_text(encoding='utf-8'))['items']:
    dest=output/item['id'];dest.mkdir(parents=True,exist_ok=True)
    images={};records={}
    for role,name in item['textureFiles'].items():
        path=source/item['sourceKey']/name;original=Image.open(path).convert('RGB')
        image=original if reference else original.resize((512,512),Image.Resampling.LANCZOS)
        before,after=ImageStat.Stat(original).mean,ImageStat.Stat(image).mean
        assert max(abs(a-b) for a,b in zip(before,after))<1,(item['id'],role,before,after)
        records[role]=dict(sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),sourceSize=list(original.size),sourceMean=before,resizedMean=after)
        images[role]=image
    images['albedo'].save(dest/'albedo.png',optimize=True);images['normal'].save(dest/'normal.png',optimize=True)
    if 'metallicRoughness' not in images:
        images['metallicRoughness']=Image.merge('RGB',(Image.new('L',images['roughness'].size,255),images['roughness'].getchannel('R'),images['metallic'].getchannel('R')))
    images['metallicRoughness'].save(dest/'metallic-roughness.png',optimize=True)
    (dest/'texture-reference.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(item['id'],'PBR textures prepared',images['albedo'].size)

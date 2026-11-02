"""Replace Shaman V2 base color, preserving every non-image GLB buffer byte.
Usage: python scripts/update-shaman-v2-texture.py INPUT_PNG
"""
from pathlib import Path
import sys,struct,json,hashlib,io,copy
from PIL import Image
root=Path(__file__).resolve().parent.parent
folder=root/'assets/models/orcs/orc-female-shaman-v2'
p=folder/'orc-female-shaman-v2.glb';meta_path=p.with_suffix('.json')
source=Path(sys.argv[1]);out=io.BytesIO()
Image.open(source).convert('RGB').resize((512,512),Image.Resampling.LANCZOS).save(out,format='PNG')
png=out.getvalue();raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+n]);old=copy.deepcopy(doc);binary=raw[28+n:]
assert len(doc['images'])==1
index=doc['images'][0]['bufferView'];view=doc['bufferViews'][index]
start=view.get('byteOffset',0);end=start+view['byteLength'];padded_end=(end+3)//4*4
replacement=png+b'\0'*((-len(png))%4);delta=len(replacement)-(padded_end-start)
newbin=binary[:start]+replacement+binary[padded_end:]
view['byteLength']=len(png)
for i,v in enumerate(doc['bufferViews']):
 if i!=index and v.get('byteOffset',0)>=padded_end:v['byteOffset']+=delta
for i,v in enumerate(doc['bufferViews']):
 if i==index:continue
 original=old['bufferViews'][i];a=original.get('byteOffset',0);b=v.get('byteOffset',0)
 assert binary[a:a+original['byteLength']]==newbin[b:b+v['byteLength']]
doc['buffers'][0]['byteLength']=len(newbin)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<III',0x46546c67,2,28+len(j)+len(newbin))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(newbin),0x004e4942)+newbin
p.write_bytes(result);sha=lambda b:hashlib.sha256(b).hexdigest()
meta=json.loads(meta_path.read_text(encoding='utf-8'));meta.update(sourceTextureSha256=sha(png),textureSourceFile=source.name,textureSourceSha256=sha(source.read_bytes()),bytes=len(result),sha256=sha(result))
meta['notes']+=' Rev 179: user Green PNG replaces base color; all non-image buffer views verified byte-identical.'
meta_path.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Updated texture:',len(result),'bytes; geometry, skin and UV buffers unchanged. PNG SHA256:',sha(png))

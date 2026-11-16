"""Resize embedded GLB color textures, preserving all non-image buffer data."""
from pathlib import Path
from PIL import Image,ImageStat
import io,struct,json,copy,hashlib,argparse
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args();source=args.source;output=args.output
payload=source.read_bytes();size=struct.unpack_from('<I',payload,12)[0]
original=json.loads(payload[20:20+size]);gltf=copy.deepcopy(original);binary=payload[28+size:]
images_by_view={image['bufferView']:i for i,image in enumerate(gltf['images'])}
new_binary=bytearray();report=[]
for index,view in enumerate(gltf['bufferViews']):
 old=original['bufferViews'][index];start=old.get('byteOffset',0);data=binary[start:start+old['byteLength']]
 if index in images_by_view:
  im=Image.open(io.BytesIO(data));im.load();assert im.size==(1024,1024) and im.mode=='RGBA'
  before=ImageStat.Stat(im).mean
  # Resample stored sRGB channels directly, without a color-space conversion.
  # Alpha is independent because the bow's glTF materials use OPAQUE mode.
  resized=Image.merge('RGBA',tuple(channel.resize((512,512),Image.Resampling.LANCZOS) for channel in im.split()))
  after=ImageStat.Stat(resized).mean
  assert all(abs(a-b)<1.0 for a,b in zip(before,after)),(images_by_view[index],before,after)
  buf=io.BytesIO();resized.save(buf,format='PNG',optimize=True);data=buf.getvalue()
  assert Image.open(io.BytesIO(data)).size==(512,512)
  report.append({'image':images_by_view[index],'beforeBytes':old['byteLength'],'afterBytes':len(data),'beforeMeanRGBA':before,'afterMeanRGBA':after})
 new_binary.extend(b'\0'*((-len(new_binary))%4));view['byteOffset']=len(new_binary);view['byteLength']=len(data);new_binary.extend(data)
new_binary.extend(b'\0'*((-len(new_binary))%4));gltf['buffers'][0]['byteLength']=len(new_binary)
for index,view in enumerate(gltf['bufferViews']):
 if index in images_by_view:continue
 old=original['bufferViews'][index];start=old.get('byteOffset',0);assert binary[start:start+old['byteLength']]==new_binary[view['byteOffset']:view['byteOffset']+view['byteLength']]
for key in ['meshes','nodes','accessors','materials','textures','images','scenes','samplers']:
 assert gltf[key]==original[key],key
encoded=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(new_binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
output.parent.mkdir(parents=True,exist_ok=True)
output.write_bytes(result)
metadata={'source':source.name,'output':output.name,'beforeBytes':len(payload),'afterBytes':len(result),'reductionPercent':round((1-len(result)/len(payload))*100,2),'triangles':3717,'textureCount':len(report),'textureResolution':[512,512],'textureEncoding':'PNG, original sRGB encoding preserved','geometryUVsMorphsMaterialsUnchanged':True,'sha256':hashlib.sha256(result).hexdigest(),'textures':report}
(output.with_suffix('.json')).write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(metadata,indent=2))

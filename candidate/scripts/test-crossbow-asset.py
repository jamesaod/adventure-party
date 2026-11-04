"""Check the shipped crossbow geometry, embedded PBR slots and decoded colors."""
from pathlib import Path
import hashlib,io,json,struct
from PIL import Image,ImageStat
root=Path(__file__).resolve().parents[1]
path=root/'assets/models/weapons/crossbows/crossbow.glb'
meta=json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
data=path.read_bytes()
assert struct.unpack_from('<III',data)==(0x46546c67,2,len(data))
assert len(data)==meta['bytes']==1030700
assert hashlib.sha256(data).hexdigest()==meta['sha256']
size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
assert not gltf.get('skins') and not gltf.get('animations')
assert len(gltf['meshes'])==4
assert {n['name'] for n in gltf['nodes']}=={'Crossbow','rope','Object001','Rope-Metal'}
counts={n['name']:sum(gltf['accessors'][p['indices']]['count']//3 for p in gltf['meshes'][n['mesh']]['primitives']) for n in gltf['nodes']}
assert counts=={'Crossbow':4006,'rope':404,'Object001':116,'Rope-Metal':152}
assert sum(counts.values())==meta['triangles']==4678 < meta['sourceTriangles']*.44
assert all('TEXCOORD_0' in p['attributes'] and 'NORMAL' in p['attributes'] for m in gltf['meshes'] for p in m['primitives'])
assert len(gltf['materials'])==1 and len(gltf['images'])==3
assert not any('uri' in x for x in gltf['buffers']+gltf['images'])
material=gltf['materials'][0];pbr=material['pbrMetallicRoughness']
def decoded(slot):
 image=gltf['images'][gltf['textures'][slot['index']]['source']];view=gltf['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
 assert image['mimeType']=='image/png' and start+view['byteLength']<=len(binary)
 im=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB');assert im.size==(512,512)
 return im
color=decoded(pbr['baseColorTexture']);normal=decoded(material['normalTexture']);packed=decoded(pbr['metallicRoughnessTexture'])
# Independent source values catch the earlier linear/sRGB dark-export defect.
for image,expected in [(color,[124.656775,105.255905,96.330128]),(normal,[127.172686,127.378310,246.326747]),(packed,[255,150.846000,38.346828])]:
 assert all(abs(a-b)<1 for a,b in zip(ImageStat.Stat(image).mean,expected))
assert min(ImageStat.Stat(color).stddev)>30,'Retain the source texture contrast'
assert pbr.get('baseColorFactor',[1,1,1,1])==[1,1,1,1]
assert pbr.get('metallicFactor',1)==pbr.get('roughnessFactor',1)==1
print('PASS crossbow: 10792 -> 4678 triangles, four parts, UVs/normals, three embedded 512px PBR maps and source colors')

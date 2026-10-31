"""Sling geometry, PBR color and provenance regression checks."""
from pathlib import Path
from PIL import Image,ImageStat
import hashlib,io,json,math,struct
root=Path(__file__).resolve().parent.parent
p=root/'assets/models/weapons/slings/sling.glb';data=p.read_bytes();meta=json.loads(p.with_suffix('.json').read_text(encoding='utf-8'))
assert len(data)==meta['bytes']==557844
assert hashlib.sha256(data).hexdigest()==meta['sha256']=='ed1f11ef26083a0b998f6bbd71dbc6b47926215f476f026d0baf8e1bd753c861'
assert struct.unpack_from('<III',data)==(0x46546c67,2,len(data))
size=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+size]);binary=data[28+size:]
def view(i):
 v=j['bufferViews'][i];return binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
assert sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])==9512
assert not j.get('skins') and not j.get('animations')
assert hashlib.sha256(view(2)).hexdigest()==meta['preservedUVSha256']=='43bf72dded0a1209a2de798195b848c664bd25ef9499dbc2e67f6f8cff83ae21'
assert hashlib.sha256(view(3)).hexdigest()==meta['preservedIndexSha256']=='1d0c3b940b498b3653c266cb232d1250564e73a302cb16ca1282d72d1126c665'
positions=list(struct.iter_unpack('<3f',view(0)));normals=list(struct.iter_unpack('<3f',view(1)))
assert len(positions)==len(normals)==7384
assert all(math.isfinite(v) for p in positions+normals for v in p)
assert all(abs(sum(v*v for v in n)-1)<1e-5 for n in normals)
assert max(p[1] for p in positions)==1 and min(p[1] for p in positions)==0
# Both cord tips converge into the palm; the pouch is wider and below them.
assert max(abs(p[0]) for p in positions if .85<p[1]<.92)<.035
assert max(abs(p[0]) for p in positions if p[1]<.15)>.08
assert len(j['images'])==3
for image,ref in zip(j['images'],meta['textures']):
 payload=view(image['bufferView']);im=Image.open(io.BytesIO(payload));im.load()
 assert im.size==(512,512) and im.mode=='RGB' and im.format=='PNG'
 assert hashlib.sha256(payload).hexdigest()==ref['sha256']
 assert max(abs(a-b) for a,b in zip(ImageStat.Stat(im).mean,ref['sourceMeanRGB']))<1
pbr=j['materials'][0]['pbrMetallicRoughness']
assert pbr.get('metallicFactor',1)==1 and pbr.get('roughnessFactor',1)==1
assert j['asset']['extras']['license']=='CC0-1.0'
assert (p.parent/'grab3d-LICENSE.txt').exists() and (p.parent/'grab3d-manifest.json').exists()
print('PASS sling: 9512 original triangles, hanging geometry, UV/index integrity, normalized normals, three 512px maps and preserved source color')

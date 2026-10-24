import json, struct,hashlib
from copy import deepcopy
from pathlib import Path
import argparse
ap=argparse.ArgumentParser(description='Combine two yaw-neutral turn clips into the untouched target GLB structure')
ap.add_argument('--target', type=Path, required=True)
ap.add_argument('--source-dir', type=Path, required=True)
ap.add_argument('--output', type=Path, required=True)
args=ap.parse_args()
P=args.source_dir
def load(path):
 b=path.read_bytes();assert b[:4]==b'glTF';length=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+length]);ix=20+length;blen=struct.unpack_from('<I',b,ix)[0];return doc,b[ix+8:ix+8+blen]
orig,bin=load(args.target);out=deepcopy(orig);outbin=bytearray(bin)
assert not out.get('animations')
for clip in ['Mixamo_sword_and_shield_turn','Mixamo_sword_and_shield_turn_2']:
 d,b=load(P/('diagnostic-yaw-decoupled-'+clip+'.glb'))
 assert d['nodes']==orig['nodes'] and d['skins']==orig['skins']
 a=d['animations'][0];indices=sorted(set([sam['input'] for sam in a['samplers']]+[sam['output'] for sam in a['samplers']]))
 mapping={}
 for k in indices:
  acc=deepcopy(d['accessors'][k]);v=deepcopy(d['bufferViews'][acc['bufferView']]);off=v.get('byteOffset',0);chunk=b[off:off+v['byteLength']]
  while len(outbin)%4:outbin.append(0)
  v['byteOffset']=len(outbin);outbin.extend(chunk);out['bufferViews'].append(v);acc['bufferView']=len(out['bufferViews'])-1;out['accessors'].append(acc);mapping[k]=len(out['accessors'])-1
 aa=deepcopy(a);aa['name']='Orc_Corrected_'+clip.replace('Mixamo_','');
 for sm in aa['samplers']:sm['input']=mapping[sm['input']];sm['output']=mapping[sm['output']]
 out.setdefault('animations',[]).append(aa)
 while len(outbin)%4:outbin.append(0)
out['buffers'][0]['byteLength']=len(outbin)
j=json.dumps(out,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
final=bytearray(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(outbin)));final.extend(struct.pack('<II',len(j),0x4e4f534a));final.extend(j);final.extend(struct.pack('<II',len(outbin),0x004e4942));final.extend(outbin)
path=args.output;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(final)
print('two clips',[(a['name'],len(a['channels'])) for a in out['animations']]);print('bytes',len(final),'sourcebinpreserved',outbin[:len(bin)]==bin,'sha256',hashlib.sha256(final).hexdigest())
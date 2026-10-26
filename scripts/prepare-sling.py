"""Fold checksum-pinned Grab3D sling into a held U; resize embedded PBR maps.
Usage: python scripts/prepare-sling.py SOURCE.glb OUTPUT.glb
"""
from pathlib import Path
from PIL import Image, ImageStat
import argparse, hashlib, io, json, math, struct
SOURCE_SHA='b71ad36709993a7a5a5787ad6464366862a5ddff3edcf9d516da526a65ffcaa6'

def fold(p):
    x,y,z=p;side=-1 if x<0 else 1
    distance=max(0,abs(x)-.035);radius=.025
    angle=min(distance/radius,1.82);rest=max(0,distance-radius*1.82)
    cx=.035+radius*math.sin(angle)+rest*math.cos(angle)
    cy=radius*(1-math.cos(angle))+rest*math.sin(angle)
    if distance==0:cx=abs(x)
    return ((side*cx-side*y*math.sin(angle))*.7,cy*1.6+y*math.cos(angle),z)

def normal_at(p,n):
    # Inverse-transpose Jacobian preserves original smooth normals at UV seams.
    h=1e-6;columns=[]
    for axis in range(3):
        a=list(p);b=list(p);a[axis]+=h;b[axis]-=h
        columns.append(tuple((u-v)/(2*h) for u,v in zip(fold(a),fold(b))))
    def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    cof=[cross(columns[1],columns[2]),cross(columns[2],columns[0]),cross(columns[0],columns[1])]
    out=[sum(cof[k][i]*n[k] for k in range(3)) for i in range(3)]
    length=math.sqrt(sum(v*v for v in out));assert length>1e-8
    return tuple(v/length for v in out)

def prepare(source,output):
    data=source.read_bytes();assert hashlib.sha256(data).hexdigest()==SOURCE_SHA,'Unexpected source; inspect before adapting recipe.'
    size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[28+size:]
    views=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in gltf['bufferViews']]
    positions=list(struct.iter_unpack('<3f',views[0]));normals=list(struct.iter_unpack('<3f',views[1]));folded=[fold(p) for p in positions]
    lo=min(p[1] for p in folded);span=max(p[1] for p in folded)-lo
    folded=[(p[0]/span,(p[1]-lo)/span,p[2]/span) for p in folded]
    views[0]=b''.join(struct.pack('<3f',*p) for p in folded)
    views[1]=b''.join(struct.pack('<3f',*normal_at(p,n)) for p,n in zip(positions,normals))
    gltf['accessors'][0]['min']=[min(p[i] for p in folded) for i in range(3)]
    gltf['accessors'][0]['max']=[max(p[i] for p in folded) for i in range(3)]
    gltf['nodes'][0].pop('translation',None);gltf['nodes'][0]['name']='sling_hanging'
    extras=gltf['nodes'][1]['extras'];extras['sourceDimensions_m']=extras.pop('dimensions_m')
    extras['notes']='Reshaped hanging sling; both cord ends meet at hand, pouch below. Static equipment, no cloth simulation.'
    extras['textures']='Three embedded 512px PBR maps; source color encoding preserved.'
    gltf['asset']['extras']={'source':'https://grab3d.com/models/weapons/sling/','license':'CC0-1.0','modifications':'Hanging U pose, normalized span, 512px PBR textures.'}
    report=[]
    for image in gltf['images']:
        index=image['bufferView'];im=Image.open(io.BytesIO(views[index]));im.load();assert im.size==(2048,2048)
        before=ImageStat.Stat(im).mean
        # Resample stored color channels, without Blender linear/sRGB conversion.
        resized=im.resize((512,512),Image.Resampling.LANCZOS);after=ImageStat.Stat(resized).mean
        assert max(abs(a-b) for a,b in zip(before,after))<1
        buf=io.BytesIO();resized.save(buf,format='PNG',optimize=True);views[index]=buf.getvalue();image['mimeType']='image/png'
        report.append({'name':image['name'],'sourceMeanRGB':before,'outputMeanRGB':after,'sha256':hashlib.sha256(views[index]).hexdigest()})
    packed=bytearray()
    for view,chunk in zip(gltf['bufferViews'],views):
        packed.extend(b'\0'*(-len(packed)%4));view['byteOffset']=len(packed);view['byteLength']=len(chunk);packed.extend(chunk)
    packed.extend(b'\0'*(-len(packed)%4));gltf['buffers'][0]['byteLength']=len(packed)
    block=json.dumps(gltf,separators=(',',':')).encode();block+=b' '*(-len(block)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(block)+len(packed))+struct.pack('<II',len(block),0x4e4f534a)+block+struct.pack('<II',len(packed),0x004e4942)+packed
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(result)
    grip=(fold((.276,.006,-.0105))[1]-lo)/span
    meta={'sourceUrl':'https://grab3d.com/models/weapons/sling/','downloadUrl':'https://grab3d.com/dl/sling/sling.glb','license':'CC0-1.0','sourceSha256':SOURCE_SHA,'sourceBytes':len(data),'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'triangles':9512,'vertices':7384,'textureResolution':512,'textureCount':3,'grip':[0,round(grip,6),0],'bounds':{'min':gltf['accessors'][0]['min'],'max':gltf['accessors'][0]['max']},'preservedUVSha256':hashlib.sha256(views[2]).hexdigest(),'preservedIndexSha256':hashlib.sha256(views[3]).hexdigest(),'textures':report,'derivation':'scripts/prepare-sling.py; symmetric smooth cord fold, normalized span, inverse-transpose normals; original UVs/indices; Pillow LANCZOS on stored channels.'}
    output.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(meta,indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args();prepare(args.source,args.output)

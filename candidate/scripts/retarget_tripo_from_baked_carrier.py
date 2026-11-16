"""Non-destructive QA transfer from a baked Mixamo/Tripo animation carrier.

Accepts a pristine animationless target GLB and an animated Mixamo-style
carrier GLB. Preserves the original target mesh/material/skin bytes; transfers
only sampled joint motions using world/bind deltas. Visual QA remains mandatory.
Requires numpy and scipy.

Example:
 python scripts/retarget_tripo_from_baked_carrier.py \
   --carrier assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb \
   --target assets/models/humans/woman-warrior/woman-warrior.glb \
   --out assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/woman-warrior-mixamo-sword-shield-full-17.glb \
   --report assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/provenance.json
"""
from __future__ import annotations
import json, struct, hashlib, math, argparse
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R

argp = argparse.ArgumentParser(description=__doc__)
argp.add_argument('--carrier', type=Path, required=True)
argp.add_argument('--target', type=Path, required=True)
argp.add_argument('--out', type=Path, required=True)
argp.add_argument('--report', type=Path, required=True)
args = argp.parse_args()
src_file, dst_file, out_file, report_file = args.carrier, args.target, args.out, args.report

def load_glb(path):
    raw=path.read_bytes();assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
    jlen,jtype=struct.unpack_from('<II',raw,12);assert jtype==0x4e4f534a
    obj=json.loads(raw[20:20+jlen]);pos=20+jlen
    blen,btype=struct.unpack_from('<II',raw,pos);assert btype==0x004e4942
    return obj,raw[pos+8:pos+8+blen],raw

def parent_map(nodes):
    parents={}
    for i,node in enumerate(nodes):
        for child in node.get('children',[]):
            if child in parents:raise ValueError('Multiple parents')
            parents[child]=i
    return parents

def rotations_and_positions(doc):
    nodes=doc['nodes'];parents=parent_map(nodes)
    computed={}
    def eval(i):
        if i in computed:return computed[i]
        n=nodes[i];local_r=R.from_quat(n.get('rotation',[0,0,0,1]));local_t=np.asarray(n.get('translation',[0,0,0]),dtype=float)
        if 'matrix' in n:
            raise ValueError('GLB matrix nodes not supported in skin rest')
        if i in parents:
            wr,wt=eval(parents[i]);rr=wr*local_r;tt=wt+wr.apply(local_t)
        else:rr,tt=local_r,local_t
        computed[i]=(rr,tt)
        return computed[i]
    for i in range(len(nodes)):eval(i)
    return computed,parents

def read_accessor(doc,binary,i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and not a.get('sparse')
    dim={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    step=v.get('byteStride',dim*4)
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    if step==dim*4:
        return np.frombuffer(binary,dtype='<f4',offset=start,count=a['count']*dim).reshape(-1,dim).copy()
    return np.asarray([np.frombuffer(binary,dtype='<f4',offset=start+j*step,count=dim) for j in range(a['count'])],dtype=np.float32)

c,b_c,source=load_glb(src_file);w,b_w,target=load_glb(dst_file)
assert not w.get('animations'),'Warrior target must not have animations'
world_c,par_c=rotations_and_positions(c);world_w,par_w=rotations_and_positions(w)
nc={n.get('name'):i for i,n in enumerate(c['nodes'])}
nw={n.get('name'):i for i,n in enumerate(w['nodes'])}
source_bones={c['nodes'][i]['name'] for i in c['skins'][0]['joints']}
target_bones={w['nodes'][i]['name'] for i in w['skins'][0]['joints']}
assert len(source_bones)>=60 and source_bones==target_bones,(len(source_bones),len(target_bones),source_bones^target_bones)
assert all(par_c[nc[name]] in nc.values() for name in source_bones)

def basis(world,ids):
    def p(name):return world[ids['mixamorig:'+name]][1]
    x=p('RightShoulder')-p('LeftShoulder');x/=np.linalg.norm(x)
    y=p('Head')-p('Hips');y-=x*np.dot(y,x);y/=np.linalg.norm(y)
    z=np.cross(x,y);z/=np.linalg.norm(z)
    return R.from_matrix(np.column_stack((x,y,z)))

C=basis(world_w,nw)*basis(world_c,nc).inv()
hips_c=nc['mixamorig:Hips'];hips_w=nw['mixamorig:Hips']
scale=world_w[hips_w][1][1]/world_c[hips_c][1][1]
# The source and target joint orientation mismatches are deliberately recorded for QA.
def angle(a,b):return math.degrees((a*b.inv()).magnitude())
mismatch={name:round(angle(world_w[nw[name]][0],C*world_c[nc[name]][0]),2) for name in sorted(source_bones)}
print('Source/target bind correction angle:',round(math.degrees(C.magnitude()),2),'scale',round(scale,4))
for n in ['Hips','LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftUpLeg','RightUpLeg']:
 print(' ',n,mismatch['mixamorig:'+n])

# Build hierarchy traversal order for all target skin bones.
by_depth={}
def depth(i):
    if i in by_depth:return by_depth[i]
    by_depth[i]=0 if i not in par_w else 1+depth(par_w[i]);return by_depth[i]
ordered=sorted(source_bones,key=lambda x:(depth(nw[x]),x))
result_bin=bytearray(b_w)
views=w.setdefault('bufferViews',[])
accessors=w.setdefault('accessors',[])

def append_float(array,components):
    arr=np.asarray(array,dtype='<f4')
    assert arr.ndim==2 and arr.shape[1]==components and np.isfinite(arr).all()
    while len(result_bin)%4:result_bin.append(0)
    off=len(result_bin);blob=arr.tobytes();result_bin.extend(blob)
    v={'buffer':0,'byteOffset':off,'byteLength':len(blob)};views.append(v)
    a={'bufferView':len(views)-1,'componentType':5126,'count':len(arr),'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[components]}
    if components==1:a.update(min=[float(arr.min())],max=[float(arr.max())])
    accessors.append(a)
    return len(accessors)-1

reports=[]
for clip in c['animations']:
    channels=clip['channels'];samples=clip['samplers']
    by_channel={}
    for ch in channels:
        source_name=c['nodes'][ch['target']['node']]['name'];path=ch['target']['path']
        samp=samples[ch['sampler']]
        assert samp.get('interpolation','LINEAR')=='LINEAR'
        timing=read_accessor(c,b_c,samp['input']).flatten()
        arr=read_accessor(c,b_c,samp['output'])
        by_channel[(source_name,path)]=(timing,arr)
    times=next(iter(by_channel.values()))[0]
    assert len(times)>1 and all(np.array_equal(times,item[0]) for item in by_channel.values())
    assert len(by_channel)>=65
    out_rot={name:[] for name in ordered};hip_positions=[]
    for frame in range(len(times)):
        animated_c={};animated_w={}
        for name in ordered:
            ic=nc[name];iw=nw[name]
            rot_c=by_channel.get((name,'rotation'))
            local_c=R.from_quat(rot_c[1][frame]) if rot_c is not None else R.from_quat(c['nodes'][ic].get('rotation',[0,0,0,1]))
            p=par_c.get(ic)
            src_parent=animated_c[p] if p in animated_c else world_c[p][0] if p is not None else R.identity()
            animated_c[ic]=src_parent*local_c
        for name in ordered:
            ic=nc[name];iw=nw[name]
            delta=animated_c[ic]*world_c[ic][0].inv()
            animated_w[iw]=(C*delta*C.inv())*world_w[iw][0]
        for name in ordered:
            iw=nw[name];p=par_w.get(iw)
            parent=animated_w[p] if p in animated_w else world_w[p][0] if p is not None else R.identity()
            quat=(parent.inv()*animated_w[iw]).as_quat().astype(np.float32)
            if out_rot[name] and np.dot(quat,out_rot[name][-1])<0:quat=-quat
            out_rot[name].append(quat)
        source_hips=by_channel.get(('mixamorig:Hips','translation'))
        if source_hips is None:
            delta_y=0.0
        else:
            delta_y=float((C.apply(source_hips[1][frame] - np.asarray(c['nodes'][hips_c].get('translation',[0,0,0]))) * scale)[1])
        hip=np.asarray(w['nodes'][hips_w].get('translation',[0,0,0]),dtype=np.float32).copy()
        hip[1]+=delta_y
        hip_positions.append(hip)
    times_id=append_float(times.reshape(-1,1),1)
    new_samples=[];new_channels=[]
    for name in ordered:
        new_samples.append({'input':times_id,'output':append_float(out_rot[name],4),'interpolation':'LINEAR'})
        new_channels.append({'sampler':len(new_samples)-1,'target':{'node':nw[name],'path':'rotation'}})
    new_samples.append({'input':times_id,'output':append_float(hip_positions,3),'interpolation':'LINEAR'})
    new_channels.append({'sampler':len(new_samples)-1,'target':{'node':hips_w,'path':'translation'}})
    w.setdefault('animations',[]).append({'name':clip['name'],'samplers':new_samples,'channels':new_channels})
    reports.append({'name':clip['name'],'seconds':round(float(times[-1]),5),'frames':len(times),'channels':len(new_channels)})
    print('Baked',clip['name'],len(times),flush=True)
assert len(w['animations'])==17
assert result_bin[:len(b_w)]==b_w
w['buffers'][0]['byteLength']=len(result_bin)
j=json.dumps(w,ensure_ascii=False,separators=(',',':')).encode('utf8');j+=b' '*(-len(j)%4)
while len(result_bin)%4:result_bin.append(0)
result=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(result_bin))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(result_bin),0x004e4942)+result_bin
out_file.parent.mkdir(parents=True,exist_ok=True)
out_file.write_bytes(result)
report={'method':'carl-17-baked-carrier-world-bind-delta-qa','original_file':dst_file.name,'original_sha256':hashlib.sha256(target).hexdigest(),'carrier_glb_sha256':hashlib.sha256(source).hexdigest(),'output_sha256':hashlib.sha256(result).hexdigest(),'size_bytes':len(result),'joint_count':len(ordered),'source_clip_count':len(c['animations']),'baked_clip_count':len(w['animations']),'basis_correction_degrees':round(math.degrees(C.magnitude()),5),'hips_height_scale':scale,'bind_quaternion_mismatch_degrees':mismatch,'clips':reports,'visual_qa':'PENDING: GLB structural validations cannot establish no limb crossing, cloth deformation, or grip correctness'}
report_file.parent.mkdir(parents=True,exist_ok=True)
report_file.write_text(json.dumps(report,indent=2)+'\n')
print('OUT',out_file,round(len(result)/1024**2,2),'MB SHA',report['output_sha256'])
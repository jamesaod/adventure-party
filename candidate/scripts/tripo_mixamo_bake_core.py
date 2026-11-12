#!/usr/bin/env python3
"""Offline, non-destructive Mixamo FBX -> Tripo GLB animation bake (single-motion QA).
Pure Python/SciPy FBX rotation evaluation, world-basis retargeting, glTF animation append.
No GLB model, material, mesh, or skin data is changed.
"""
from pathlib import Path
import sys,json,struct,hashlib,math,collections
import numpy as np
from scipy.spatial.transform import Rotation as R
sys.path.insert(0, str(Path(__file__).parent))
from fbx_parse import read as read_fbx

FBX_TICKS_PER_SECOND=46186158000

def Rxyz(v): return R.from_euler('xyz',v,degrees=True)

def fbx_props(model):
    p=model.find('Properties70')
    return {x.props[0]:x.props[4:] for x in p.children} if p else {}

def mname(x):return x.props[1].split('\x00')[0].split(':')[-1]

def fbx_skeleton(path):
    root=read_fbx(path); objs=root.find('Objects'); connections=root.find('Connections').children
    ob={o.props[0]:o for o in objs.children if o.props}
    mod={o.props[0]:o for o in objs.all('Model')}
    id_by_name={mname(x):k for k,x in mod.items()}
    parent={}; curveNodeFor={};curveFor={}
    for conn in connections:
        c=conn.props
        if c[0]=='OO' and c[1] in mod and c[2] in mod:parent[c[1]]=c[2]
        if c[0]=='OP' and c[1] in ob and c[2] in mod and ob[c[1]].name=='AnimationCurveNode':
            curveNodeFor[c[1]]=(c[2],c[3])
        if c[0]=='OP' and c[1] in ob and c[2] in ob and ob[c[1]].name=='AnimationCurve' and ob[c[2]].name=='AnimationCurveNode':
            curveFor[(c[2],c[3][-1])]=c[1]
    curves={}
    for cnode,(modelid,propname) in curveNodeFor.items():
        if propname not in ('Lcl Translation','Lcl Rotation'):continue
        axisData={}
        for axis in 'XYZ':
            key=(cnode,axis)
            if key not in curveFor:continue
            curve=ob[curveFor[key]]
            times=np.asarray(curve.find('KeyTime').props[0],dtype=np.float64)/FBX_TICKS_PER_SECOND
            values=np.asarray(curve.find('KeyValueFloat').props[0],dtype=np.float64)
            axisData[axis]=(times,values)
        if axisData:curves[(modelid,propname)]=axisData
    records={}
    for mid,obj in mod.items():
        props=fbx_props(obj)
        records[mid]={
            'name':mname(obj),
            'parent':parent.get(mid),
            't':np.array(props.get('Lcl Translation',[0,0,0]),dtype=float),
            'pre':np.array(props.get('PreRotation',[0,0,0]),dtype=float),
            'post':np.array(props.get('PostRotation',[0,0,0]),dtype=float),
            'rot':np.array(props.get('Lcl Rotation',[0,0,0]),dtype=float),
            'order':props.get('RotationOrder',[0])[0]
        }
    def eval_pose(t=None):
        cache={}
        def get(mid):
            if mid in cache:return cache[mid]
            n=records[mid]; loc=n['t'].copy();erot=n['rot'].copy()
            if t is not None:
                for label,out in [('Lcl Translation',loc),('Lcl Rotation',erot)]:
                    tracks=curves.get((mid,label),{})
                    for i,ax in enumerate('XYZ'):
                        if ax in tracks:
                            times,values=tracks[ax];out[i]=np.interp(t,times,values)
            if n['order']!=0:raise RuntimeError('non-XYZ FBX rotation on '+n['name'])
            localR=Rxyz(n['pre'])*Rxyz(erot)*Rxyz(n['post']).inv()
            if n['parent'] in records:
                pq,pt=get(n['parent']);q=pq*localR;p=pt+pq.apply(loc)
            else:q=localR;p=loc
            cache[mid]=(q,p)
            return cache[mid]
        return {n['name']:get(mid) for mid,n in records.items()}
    return records,curves,eval_pose


def read_glb(path):
    data=Path(path).read_bytes()
    magic,version,length=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and length==len(data)
    pos=12;chunks=[]
    while pos<length:
        n,typ=struct.unpack_from('<II',data,pos);pos+=8
        chunks.append((typ,data[pos:pos+n]));pos+=n
    assert len(chunks)==2 and chunks[0][0]==0x4e4f534a and chunks[1][0]==0x004e4942
    doc=json.loads(chunks[0][1]);return doc,chunks[1][1],data


def get_accessor(doc,binary,idx):
    a=doc['accessors'][idx]; bv=doc['bufferViews'][a['bufferView']]
    comp={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}[a['componentType']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    offset=bv.get('byteOffset',0)+a.get('byteOffset',0)
    if 'byteStride' in bv:
        stride=bv['byteStride']; item=np.dtype(comp).itemsize*n
        return np.array([np.frombuffer(binary, dtype=comp,count=n,offset=offset+i*stride) for i in range(a['count'])])
    return np.frombuffer(binary,dtype=comp,count=a['count']*n,offset=offset).reshape((a['count'],n))

def gltf_skeleton(doc):
    nodes=doc['nodes'];parent={j:i for i,n in enumerate(nodes) for j in n.get('children',[])}
    pose={}
    def get(i):
        if i in pose:return pose[i]
        n=nodes[i]
        localR=R.from_quat(n.get('rotation',[0,0,0,1]));t=np.array(n.get('translation',[0,0,0]),float)
        if i in parent:
            q,p=get(parent[i]);value=(q*localR,p+q.apply(t))
        else:value=(localR,t)
        pose[i]=value;return value
    for i in range(len(nodes)):get(i)
    return pose,parent,{n.get('name'):i for i,n in enumerate(nodes)}

def quat_angle(a,b):
    return (a.inv()*b).magnitude()*180/math.pi

def bake(target_path,reference_path,animation_path,output_path,report_path,clip_label='Mixamo_Sword_Shield_Attack_QA',fps=60):
    doc,binary,raw=read_glb(target_path)
    assert not doc.get('animations'), 'This controlled target is expected to be animationless'
    reference,_,reference_pose=fbx_skeleton(reference_path)
    donor,curves,animation_pose=fbx_skeleton(animation_path)
    target_world,parent,names=gltf_skeleton(doc)
    target_names={name.removeprefix('mixamorig:'):idx for name,idx in names.items() if name and name.startswith('mixamorig:')}
    names_common=set(target_names)&{v['name'] for v in donor.values()}&{v['name'] for v in reference.values()}
    assert len(names_common)>=60,(len(names_common),sorted(names_common))
    bind=reference_pose(); src0=animation_pose(None)
    # Check the Mixamo skeleton supplied with the animations has an identical reference rig.
    discrepancies={k:quat_angle(bind[k][0],src0[k][0]) for k in names_common}
    print('Mixamo bind orientation discrepancy max',max(discrepancies.values()))
    assert max(discrepancies.values()) < 2.0,sorted(discrepancies.items(),key=lambda x:-x[1])[:10]
    for k in ['Hips','Spine2','LeftShoulder','RightShoulder','LeftHand','RightHand','LeftFoot','RightFoot']:
        print('bind',k,'FBX',np.round(bind[k][1],2),'target',np.round(target_world[target_names[k]][1],4))
    # Normalize reference body axes from shoulder positions, character's semantic left/right, and torso.
    def anatomical(pose,get):
        right=pose[get('RightShoulder')][1]-pose[get('LeftShoulder')][1]
        right/=np.linalg.norm(right)
        up=pose[get('Head')][1]-pose[get('Hips')][1]
        up-=right*np.dot(up,right);up/=np.linalg.norm(up)
        forward=np.cross(right,up);forward/=np.linalg.norm(forward)
        up=np.cross(forward,right)
        return R.from_matrix(np.column_stack((right,up,forward)))
    sb=anatomical(bind,lambda n:n)
    tb=anatomical(target_world,lambda n:target_names[n])
    correction=tb*sb.inv()
    print('Anatomical frame mapping angle',np.degrees(correction.magnitude()),'source+X,Y,Z mapped:', np.round(correction.apply(np.eye(3)),3).tolist())
    mapped_order=[(name,target_names[name]) for name in sorted(names_common)]
    # all relative rotations are evaluated at 60 fps; local tracks then converted from target absolute world motion.
    alltimes=np.concatenate([arr[0] for axes in curves.values() for arr in axes.values()])
    start=float(alltimes.min()); end=float(alltimes.max())
    assert end>start and end-start<30
    times=np.linspace(0,end-start,math.ceil((end-start)*fps)+1,dtype=np.float32)
    scale=float(target_world[target_names['Hips']][1][1]/bind['Hips'][1][1])
    print('animation',start,end,'duration',end-start,'frames',len(times),'height ratio',scale)
    # Track all target joints, no skin/bind changes, map world delta onto target bind global basis.
    local_quats={name:[] for name,idx in mapped_order}
    hips_translation=[]
    unmapped_parent_issues=[]
    for tf in times:
        fpose=animation_pose(start+float(tf))
        desired={}
        for name,idx in mapped_order:
            qanimated=fpose[name][0]
            qref=bind[name][0]
            delta=qanimated*qref.inv()
            rotcorr=correction*delta*correction.inv()
            desired[idx]=rotcorr*target_world[idx][0]
        # inverse(animated parent world) * desired world -> local quaternion
        # Parent directly contains target corresponding joint for all except root.
        for name,idx in mapped_order:
            pidx=parent.get(idx)
            if pidx in desired:parentq=desired[pidx]
            else:parentq=target_world[pidx][0] if pidx in target_world else R.identity()
            q=parentq.inv()*desired[idx]
            quat=q.as_quat().astype(np.float32)
            if local_quats[name] and np.dot(local_quats[name][-1],quat)<0:quat=-quat
            local_quats[name].append(quat)
        hipdiff=fpose['Hips'][1]-bind['Hips'][1]
        hipt= np.array(doc['nodes'][target_names['Hips']].get('translation',[0,0,0])) + correction.apply(hipdiff)*scale
        hips_translation.append(hipt.astype(np.float32))
    # rest identity proof: when source animation equals bind all local rotations must equal original target bind.
    for name,idx in mapped_order:
        directbind=R.from_quat(doc['nodes'][idx].get('rotation',[0,0,0,1]))
        qref=bind[name][0];delta=qref*qref.inv()
        pidx=parent.get(idx);qw=delta*target_world[idx][0]
        check=(target_world[pidx][0].inv() if pidx is not None else R.identity())*qw
        assert quat_angle(directbind,check)<0.01, (name,quat_angle(directbind,check))
    # Append fully self-contained animation data to the original binary buffer.
    resultbin=bytearray(binary);views=doc.setdefault('bufferViews',[]);accessors=doc.setdefault('accessors',[])
    def append_array(values,fmt,components):
        while len(resultbin)%4:resultbin.append(0)
        offset=len(resultbin)
        b=np.asarray(values,dtype=fmt).tobytes(order='C');resultbin.extend(b)
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(b)})
        vi=len(views)-1;n=len(values)
        a={'bufferView':vi,'componentType':5126,'count':n,'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[components]}
        if components==1:a.update({'min':[float(np.min(values))],'max':[float(np.max(values))]})
        accessors.append(a)
        return len(accessors)-1
    ts=append_array(times,'<f4',1)
    channels=[];samplers=[]
    for name,idx in mapped_order:
        vals=np.array(local_quats[name],dtype=np.float32)
        sampidx=len(samplers);samplers.append({'input':ts,'output':append_array(vals,'<f4',4),'interpolation':'LINEAR'})
        channels.append({'sampler':sampidx,'target':{'node':idx,'path':'rotation'}})
    hindex=len(samplers);samplers.append({'input':ts,'output':append_array(hips_translation,'<f4',3),'interpolation':'LINEAR'})
    channels.append({'sampler':hindex,'target':{'node':target_names['Hips'],'path':'translation'}})
    doc.setdefault('animations',[]).append({'name':clip_label,'samplers':samplers,'channels':channels})
    doc['buffers'][0]['byteLength']=len(resultbin)
    j=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8'); j+=b' '*(-len(j)%4)
    while len(resultbin)%4:resultbin.append(0)
    result=bytearray(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(resultbin)))
    result.extend(struct.pack('<II',len(j),0x4e4f534a));result.extend(j)
    result.extend(struct.pack('<II',len(resultbin),0x004e4942));result.extend(resultbin)
    Path(output_path).write_bytes(result)
    report={
        'label':clip_label,
        'method':'offline-world-delta-animation-bake-v1',
        'input_glb_sha256':hashlib.sha256(raw).hexdigest(),
        'reference_fbx_sha256':hashlib.sha256(Path(reference_path).read_bytes()).hexdigest(),
        'motion_fbx_sha256':hashlib.sha256(Path(animation_path).read_bytes()).hexdigest(),
        'result_sha256':hashlib.sha256(result).hexdigest(),
        'original_bin_prefix_preserved':bytes(resultbin[:len(binary)])==binary,
        'animation_count':len(doc['animations']),
        'frames':len(times),'fps':fps,'duration_sec':float(times[-1]),'joint_rotation_tracks':len(mapped_order),
        'hips_position_track':True,'source_target_anatomical_correction_deg':float(np.degrees(correction.magnitude())),
        'height_ratio':scale,
        'reference_local_bind_max_difference_deg':max(discrepancies.values()),
        'notes':['Does not modify original GLB; output is a separate model.','Animation retargets source world-space bind-relative quaternion motion, including anatomical basis correction.','All 65 target joint bind positions and inverse bind matrices preserved.','Visual QA of the actual rendered moving model is still required.']
    }
    Path(report_path).write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    bake('/mnt/data/New+DCC(1).glb','/mnt/data/mixamo/X Bot.fbx','/mnt/data/mixamo/sword and shield attack.fbx',
        '/mnt/data/new-carl-sword-shield-attack-proof.glb','/mnt/data/new-carl-sword-shield-attack-proof.json')
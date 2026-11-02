"""Minimal FBX 7700 binary node reader for offline Mixamo QA."""
from pathlib import Path
import struct,zlib,array

class Node:
    __slots__=('name','props','children')
    def __init__(self,name,props,children):self.name,self.props,self.children=name,props,children
    def find(self,name):return next((c for c in self.children if c.name==name),None)
    def all(self,name):return [c for c in self.children if c.name==name]
    def __repr__(self):return f'Node({self.name}, {str(self.props)[:80]}, {len(self.children)} children)'

def read(path):
    data=Path(path).read_bytes(); assert data.startswith(b'Kaydara FBX Binary')
    version=struct.unpack_from('<I',data,23)[0];assert version>=7500
    def props_at(pos):
        t=chr(data[pos]);pos+=1
        singles={'Y':('h',2),'C':('B',1),'I':('i',4),'F':('f',4),'D':('d',8),'L':('q',8)}
        if t in singles:
            fmt,size=singles[t];return struct.unpack_from('<'+fmt,data,pos)[0],pos+size
        if t in 'SR':
            l=struct.unpack_from('<I',data,pos)[0];pos+=4
            b=data[pos:pos+l];pos+=l
            return (b.decode('utf-8','replace') if t=='S' else b),pos
        if t in 'fdlibc':
            length,encoding,compressed=struct.unpack_from('<III',data,pos);pos+=12
            chunk=data[pos:pos+compressed];pos+=compressed
            if encoding==1: chunk=zlib.decompress(chunk)
            assert encoding in (0,1)
            typecode={'f':'f','d':'d','l':'q','i':'i','b':'b','c':'B'}[t]
            vals=array.array(typecode);vals.frombytes(chunk)
            assert len(vals)==length,(t,length,len(vals))
            return vals,pos
        raise ValueError((t,pos))
    def parse_node(pos):
        end,nprops,plen,nlen=struct.unpack_from('<QQQB',data,pos)
        if not end:return None,pos+25
        name=data[pos+25:pos+25+nlen].decode('utf-8','replace');pos+=25+nlen
        props=[]
        for _ in range(nprops):
            val,pos=props_at(pos);props.append(val)
        children=[]
        while pos+25<=end:
            if not any(data[pos:pos+25]):pos+=25;break
            c,nxt=parse_node(pos)
            if c is None:break
            children.append(c);pos=nxt
        assert pos<=end,(name,pos,end)
        return Node(name,props,children),end
    pos=27;nodes=[]
    while pos+25<len(data) and any(data[pos:pos+25]):
        n,pos=parse_node(pos)
        if n is None:break
        nodes.append(n)
    return Node('Root',[],nodes)

if __name__=='__main__':
    import sys,collections
    f=read(sys.argv[1]);print('root',f.children)
    ob=f.find('Objects'); cn=f.find('Connections')
    print('obj counts',collections.Counter(x.name for x in ob.children))
    for x in ob.children[:20]:print('obj',x.name,x.props[:4], [c.name for c in x.children[:8]])
    print('connections',len(cn.children),cn.children[:8])
    for x in ob.all('AnimationStack'):print('stack',x.props)
    for x in ob.all('AnimationCurveNode')[:8]:print('cnode',x.props)
    for x in ob.all('AnimationCurve')[:3]: print('curve',x.props,'kids',[(n.name,len(n.props),len(n.props[0]) if n.props and isinstance(n.props[0],array.array) else None) for n in x.children])

// Radix-sort coarse Float32 depth keys, then resolve equal keys with the original
// full-precision depth/x comparator. This preserves exact painter ordering.
export function createCoverDepthSorter(){
 let capacity=0,keys,values,first,second,saved=[];const counts=new Uint32Array(256);
 return items=>{const n=items.length;if(n<512){items.sort((a,b)=>a.sortY-b.sortY||a.x-b.x);return;}
 if(n>capacity){capacity=2**Math.ceil(Math.log2(n));keys=new Uint32Array(capacity);values=new Float32Array(keys.buffer);first=new Uint32Array(capacity);second=new Uint32Array(capacity);}
 for(let i=0;i<n;i++){values[i]=items[i].sortY===0?0:items[i].sortY;const bits=keys[i];keys[i]=(bits&0x80000000)?~bits:bits^0x80000000;first[i]=i;saved[i]=items[i];}saved.length=n;
 let src=first,dst=second;
 for(let shift=0;shift<32;shift+=8){counts.fill(0);for(let i=0;i<n;i++)counts[(keys[src[i]]>>>shift)&255]++;let offset=0;for(let i=0;i<256;i++){const count=counts[i];counts[i]=offset;offset+=count;}for(let i=0;i<n;i++){const id=src[i];dst[counts[(keys[id]>>>shift)&255]++]=id;}[src,dst]=[dst,src];}
 for(let i=0;i<n;i++)items[i]=saved[src[i]];
 for(let start=0;start<n;){let end=start+1;while(end<n&&keys[src[end]]===keys[src[start]])end++;if(end-start>1){const tied=items.slice(start,end).sort((a,b)=>a.sortY-b.sortY||a.x-b.x);for(let j=0;j<tied.length;j++)items[start+j]=tied[j];}start=end;}
 };
}

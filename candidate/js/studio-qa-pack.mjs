/** Import a local QA ZIP without changing or uploading source GLB/FBX files. */
export const QA_PACK_FORMAT='adventure-party-humanoid-qa-pack';
function valid(value,detail){if(!value)throw Error('Invalid humanoid QA pack: '+detail);}
export async function readHumanoidQaPack(file){
  valid(file?.size>100&&file.size<80e6&&typeof file.arrayBuffer==='function','Select a ZIP under 80 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=n=>view.getUint16(n,true),u32=n=>view.getUint32(n,true);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
    if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
  }
  valid(end>=0,'Missing ZIP end directory.');
  const count=u16(end+10),size=u32(end+12);let offset=u32(end+16);
  valid(count>0&&count<=50&&offset+size<=end,'Invalid ZIP central directory.');
  const entries=new Map(),decode=new TextDecoder();
  let total=0;
  for(let n=0;n<count;n++){
    valid(offset+46<=bytes.length&&u32(offset)===0x02014b50,'Invalid ZIP entry.');
    const flags=u16(offset+8),method=u16(offset+10),packed=u32(offset+20),unpacked=u32(offset+24);
    const nameLen=u16(offset+28),extra=u16(offset+30),comment=u16(offset+32),local=u32(offset+42);
    valid(!(flags&1)&&(method===0||method===8),'Encrypted or unsupported ZIP compression.');
    valid(offset+46+nameLen+extra+comment<=bytes.length,'Truncated filename.');
    const name=decode.decode(bytes.subarray(offset+46,offset+46+nameLen));
    offset+=46+nameLen+extra+comment;
    valid(name&&!name.includes('\\')&&!name.includes('..')&&!name.startsWith('/')&&!entries.has(name),'Unsafe/duplicate path.');
    if(name.endsWith('/'))continue;
    total+=unpacked;
    valid(unpacked<=12e6&&total<=50e6,'File or total extraction too large.');
    valid(local+30<=bytes.length&&u32(local)===0x04034b50,'Missing ZIP local header.');
    const start=local+30+u16(local+26)+u16(local+28);
    valid(start+packed<=bytes.length,'ZIP data truncated.');
    entries.set(name,{data:bytes.subarray(start,start+packed),method,size:unpacked});
  }
  async function extract(path){
    const entry=entries.get(path);
    valid(entry,'Missing ZIP member '+path);
    let content;
    if(entry.method===0)content=entry.data;
    else{
      valid(typeof DecompressionStream==='function','Please use current Chrome or Edge for deflate-raw ZIP support.');
      const stream=new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      content=new Uint8Array(await new Response(stream).arrayBuffer());
    }
    valid(content.length===entry.size,'Incorrect extracted length for '+path);
    return content;
  }
  const manifest=JSON.parse(decode.decode(await extract('adventure-party-qa-pack.json')));
  valid(manifest?.format===QA_PACK_FORMAT&&manifest.version===1,'Unrecognized manifest format.');
  valid(Array.isArray(manifest.models)&&manifest.models.length===2&&
    Array.isArray(manifest.animations)&&manifest.animations.length>=1&&manifest.animations.length<=25,
    'Expected two models and 1–25 animations.');
  const paths=[...manifest.models.map(m=>m.path),...manifest.animations.map(a=>a.path)];
  valid(new Set(paths).size===paths.length,'Duplicate manifest paths.');
  for(const m of manifest.models)valid(typeof m.id==='string'&&typeof m.label==='string'&&
    /^models\/[a-z0-9-]+\.glb$/i.test(m.path),'Invalid GLB model entry.');
  for(const a of manifest.animations)valid(typeof a.label==='string'&&
    /^animations\/[a-z0-9-]+\.fbx$/i.test(a.path),'Invalid animation entry.');
  const files=new Map();
  for(const path of paths){
    const content=await extract(path);
    if(path.endsWith('.glb'))valid(content.length>=20&&
      String.fromCharCode(...content.subarray(0,4))==='glTF','Invalid GLB '+path);
    if(path.endsWith('.fbx'))valid(decode.decode(content.subarray(0,18))==='Kaydara FBX Binary',
      'Invalid FBX '+path);
    files.set(path,new File([content],path.split('/').pop(),{
      type:path.endsWith('.glb')?'model/gltf-binary':'application/octet-stream'
    }));
  }
  return {manifest,files,modelCount:manifest.models.length,animationCount:manifest.animations.length};
}

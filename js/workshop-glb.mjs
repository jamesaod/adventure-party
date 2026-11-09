// A published unit must remain usable without the author's local asset folder.
export function validateWorkshopGlb(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(data.byteLength<20)throw Error('Workshop model is not a complete GLB.');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.length)throw Error('Workshop model must be a valid GLB 2.0 file.');
 let json=null;
 for(let at=12;at<data.length;){
  if(at+8>data.length)throw Error('Truncated GLB chunk.');
  const length=view.getUint32(at,true),type=view.getUint32(at+4,true);at+=8;
  if(length%4||at+length>data.length)throw Error('Invalid GLB chunk length.');
  if(type===0x4e4f534a){if(json)throw Error('Duplicate GLB JSON chunk.');json=JSON.parse(new TextDecoder().decode(data.subarray(at,at+length)));}
  at+=length;
 }
 if(!json||json.asset?.version!=='2.0')throw Error('Missing GLB 2.0 document.');
 for(const resource of [...(json.buffers||[]),...(json.images||[])])if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('Workshop GLB must embed its buffers and textures. External dependency: '+resource.uri);
 return json;
}

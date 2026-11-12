// Asynchronous elapsed GPU queries. Never wait for the GPU or overlap queries.
export function createGpuPerformance(gl){
 const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 let pending=[],history=[],frame=0,sampling=false,current=null,active=false;
 function clear(){for(const f of pending)for(const q of f.queries)gl.deleteQuery(q.query);pending=[];history=[];}
 return {
 begin(){
  sampling=false;if(!ext||gl.isContextLost())return;
  if(gl.getParameter(ext.GPU_DISJOINT_EXT)){clear();return;}
  while(pending.length&&pending[0].queries.every(q=>gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE))){
   const f=pending.shift(),times={};for(const q of f.queries){times[q.name]=(times[q.name]||0)+gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q.query);}history.push(times);if(history.length>30)history.shift();
  }
  sampling=++frame%15===0&&pending.length<2;current={queries:[]};
 },
 measure(name,fn){if(!sampling||active||!ext)return fn();const query=gl.createQuery();if(!query)return fn();active=true;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);try{return fn();}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);active=false;current.queries.push({name,query});}},
 end(){if(sampling&&current.queries.length)pending.push(current);sampling=false;},
 snapshot(){const times={};for(const row of history)for(const [k,v] of Object.entries(row))times[k]=(times[k]||0)+v/history.length;return {supported:!!ext,samples:history.length,times};},
 dispose:clear
 };
}

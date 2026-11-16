// Same ground rotation and compression as combat: rotation 5, HEX_W=64, HEX_ROW=31.5.
export function projection(isometric=false,rotation=0){const angle=(isometric?-Math.PI/3:0)+rotation*Math.PI/3,s=isometric?31.5/(64*Math.sqrt(3)/2):1,c=Math.cos(angle),n=Math.sin(angle);return {a:c,b:n*s,c:-n,d:c*s};}
export function project(p,m){return {x:m.a*p.x+m.c*p.y,y:m.b*p.x+m.d*p.y};}
export function unproject(p,m){const det=m.a*m.d-m.b*m.c;return {x:(m.d*p.x-m.c*p.y)/det,y:(-m.b*p.x+m.a*p.y)/det};}

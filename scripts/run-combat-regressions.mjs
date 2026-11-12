import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url);
export function combatRegressionFiles(){return readdirSync(new URL('scripts/',root)).filter(n=>/^test-(?:combat-|workshop-|bow-|arrow-|flaming-sword|animation-timeline|window-targeting|lodged-arrow|racial-traits|quiver-arrows|opportunity-attacks).*\.mjs$/.test(n)).sort().map(n=>'scripts/'+n);}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const files=combatRegressionFiles();
 if(process.argv.includes('--list'))console.log(files.join('\n'));
 else{let passed=0;for(const file of files){const r=spawnSync(process.execPath,[file],{cwd:fileURLToPath(root),encoding:'utf8',timeout:120000});
 if(r.status===0)passed++;else{console.error('FAIL '+file+'\n'+(r.stdout||'')+(r.stderr||'')+(r.error||''));}}
 console.log('Combat regressions: '+passed+'/'+files.length+' passed');if(passed!==files.length)process.exitCode=1;}
}

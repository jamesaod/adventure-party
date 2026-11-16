// Run against the local game server. PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE
// must point at the host Playwright package and Chrome executable.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const checks=['probe-combat-material-lighting.cjs','probe-combat-snow-ambient.cjs','probe-combat-ground-cover.cjs','probe-combat-grass-antialiasing.cjs','probe-combat-start-grid.cjs','probe-combat-controls.cjs','probe-combat-fireball-snow-regression.cjs','probe-combat-corpse-snow-opacity.cjs','probe-combat-snow-burial.cjs','probe-combat-destination-movement.cjs'];
let failed=0;
for(const check of checks){console.log('\n'+check);const result=spawnSync(process.execPath,[path.join(__dirname,check)],{cwd:root,env:process.env,stdio:'inherit',timeout:120000});if(result.error||result.status!==0){failed++;console.error(result.error?.message||'Probe failed: '+check);}}
console.log(`Combat browser checks: ${checks.length-failed}/${checks.length} passed`);process.exitCode=failed?1:0;

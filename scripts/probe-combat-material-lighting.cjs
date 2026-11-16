const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:8276/scripts/fixtures/combat-material-lighting.html');
 await page.waitForFunction(()=>document.body.dataset.result);
 const result=await page.locator('#result').textContent();
 if(!result.startsWith('PASS')||errors.length)throw Error(result+'\n'+errors.join('\n'));
 console.log(result);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

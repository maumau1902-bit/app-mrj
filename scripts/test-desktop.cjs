const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const pkg = require('../package.json');
async function main() {
  const installed = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const executablePath = installed || require('electron');
  const args = process.platform === 'linux' ? ['--no-sandbox','--ozone-platform=headless','--disable-gpu'] : [];
  if (!installed) args.push(path.resolve(__dirname,'..'));
  const app = await _electron.launch({executablePath,args,timeout:30000,env:{...process.env,...(process.platform==='linux'?{XDG_CONFIG_HOME:'/tmp/pulse-desktop-smoke',XDG_CACHE_HOME:'/workspace/.cache'}:{})}});
  try {
    const page = await app.firstWindow();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.getByRole('heading',{name:'Seu negócio em foco.'}).waitFor();
    assert.match(await page.locator('.metrics').innerText(),/2\.820,00/);
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
    assert.equal(await page.locator('img.brand-symbol').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    await page.locator('[data-page="Vendas ao vivo"]').click();
    assert.equal(await page.locator('tbody tr').count(),6);
    await page.locator('#search').fill('Ana');assert.equal(await page.locator('tbody tr').count(),2);
    await page.locator('[data-page="Atualizações"]').click();
    const state = await page.evaluate(()=>window.pulseDesktop.updates.getState());
    assert.equal(state.currentVersion,pkg.version);
    assert.equal(await page.evaluate(()=>window.pulseDesktop.updates.install()),false);
    if(!installed) assert.equal(state.status,'disabled');
    assert.match(await page.locator('.version-tag').innerText(),new RegExp(pkg.version.replaceAll('.','\\.')));
    assert.deepEqual(errors,[]);
    if(process.env.GITHUB_ACTIONS==='true'){
      const dir=path.resolve('release/screenshots');fs.mkdirSync(dir,{recursive:true});
      await page.screenshot({path:path.join(dir,'desktop-updates.png')});
    }
    console.log('PASS: desktop real, recursos locais, indicadores, busca, preload isolado, versão e proteção de instalação.');
  } finally {await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

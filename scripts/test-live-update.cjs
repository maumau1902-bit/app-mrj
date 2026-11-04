// Executed only by the disposable Windows runner, against actual installed packages.
const{_electron}=require('playwright-core');const assert=require('node:assert/strict');const pkg=require('../package.json');
async function main(){
 const[exe,phase]=process.argv.slice(2);if(process.platform!=='win32'||process.env.RUNNER_ENVIRONMENT!=='github-hosted')throw new Error('Use o runner Windows descartável');
 const app=await _electron.launch({executablePath:exe,args:[],timeout:30000});let closed=false;app.on('close',()=>closed=true);
 try{
  const page=await app.firstWindow();await page.getByRole('heading',{name:'Seu negócio em foco.'}).waitFor();
  if(phase==='verify'){
   assert.equal((await page.evaluate(()=>window.pulseDesktop.updates.getState())).currentVersion,pkg.version);
   assert.equal(await page.getByRole('tab',{name:'Empresa preservada CI',exact:true}).getAttribute('aria-selected'),'true');
   console.log('PASS: nova versão abriu e preservou o cadastro/seleção da empresa.');return;
  }
  await page.locator('.company-switcher [data-new-company]').click();await page.getByLabel('Nome na aba *',{exact:true}).fill('Empresa preservada CI');await page.getByRole('button',{name:'Salvar empresa',exact:true}).click();
  await page.locator('[data-page="Atualizações"]').click();
  await page.evaluate(async()=>{await window.pulseDesktop.updates.check()});
  await page.waitForFunction(()=>window.pulseDesktop.updates.getState().then(s=>s.status==='available'),null,{timeout:60000});
  const before=await page.evaluate(()=>window.pulseDesktop.updates.getState());assert.equal(before.currentVersion,'0.3.0');assert.equal(before.availableVersion,pkg.version);
  await page.getByRole('button',{name:'Baixar atualização',exact:true}).first().click();
  await page.waitForFunction(()=>window.pulseDesktop.updates.getState().then(s=>s.status==='downloaded'),null,{timeout:240000});
  const finished=app.waitForEvent('close',{timeout:60000});
  await page.getByRole('button',{name:'Instalar e reiniciar',exact:true}).first().click();await finished;
  console.log('PASS: assinatura/catálogo públicos, aviso, download real e encerramento para instalação pelo app.');
 }finally{if(!closed)await app.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});

const {_electron}=require('playwright-core');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pulse-company-test-'));
 const app=await _electron.launch({executablePath:require('electron'),args:[...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[]),path.resolve(__dirname,'..')],env:{...process.env,XDG_CONFIG_HOME:temp,XDG_CACHE_HOME:temp},timeout:30000});
 try{
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'Seu negócio em foco.'}).waitFor();
  assert.equal(await page.getByRole('tab',{name:'Empresa 1',exact:true}).getAttribute('aria-selected'),'true');
  for(let n=2;n<=4;n++){
   await page.locator('.company-switcher [data-new-company]').click();
   await page.getByLabel('Nome na aba *',{exact:true}).fill('Empresa '+n);
   await page.getByLabel('CNPJ / identificação',{exact:true}).fill('ID-'+n);
   await page.getByLabel('Identificador no Mithra',{exact:true}).fill('BASE-'+n);
   await page.getByRole('button',{name:'Salvar empresa',exact:true}).click();
   assert.equal(await page.getByRole('tab',{name:'Empresa '+n,exact:true}).getAttribute('aria-selected'),'true');
   assert.match(await page.locator('.metrics').innerText(),/R\$\s*0,00/);
   assert.doesNotMatch(await page.locator('main').innerText(),/NaN|Infinity/);
  }
  await page.reload();await page.getByRole('heading',{name:'Seu negócio em foco.'}).waitFor();
  assert.equal(await page.getByRole('tab',{name:'Empresa 4',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('tab',{name:'Empresa 1',exact:true}).click();assert.match(await page.locator('.metrics').innerText(),/2\.820,00/);
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,768]]){
   await page.setViewportSize({width,height});const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));
   assert.ok(dims.w<=width,`overflow horizontal ${width}: ${dims.w}`);assert.ok(dims.h<=height,`overflow vertical ${width}x${height}: ${dims.h}`);
  }
  await page.getByRole('tab',{name:'Empresa 4',exact:true}).click();
  await page.getByRole('button',{name:'Editar empresa selecionada'}).click();
  await page.getByLabel('Nome na aba *',{exact:true}).fill('Loja Sul');await page.getByLabel('Cidade',{exact:true}).fill('Salvador');await page.getByLabel('UF',{exact:true}).fill('ba');
  await page.getByRole('button',{name:'Salvar empresa',exact:true}).click();
  await page.locator('[data-page="Empresas e conexões"]').click();assert.match(await page.locator('.company-cards').innerText(),/Salvador \/ BA/);
  await page.locator('[data-page="Configurações"]').click();await page.locator('#photo').setInputFiles(path.resolve('build/icon.png'));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pulse-companies-v1')).companies.find(c=>c.name==='Loja Sul').photo.startsWith('data:image/'));
  const photo=await page.locator('.workspace .company-photo img').getAttribute('src');assert.ok(photo.startsWith('data:image/'));
  await page.getByRole('tab',{name:'Empresa 2',exact:true}).click();assert.equal(await page.locator('.workspace .company-photo img').count(),0);
  await page.getByRole('tab',{name:'Loja Sul',exact:true}).click();assert.equal(await page.locator('.workspace .company-photo img').getAttribute('src'),photo);
  await page.getByRole('button',{name:'Editar empresa selecionada'}).click();await page.getByLabel('Nome na aba *',{exact:true}).fill('Empresa 1');await page.getByRole('button',{name:'Salvar empresa',exact:true}).click();await page.getByRole('alert').filter({hasText:'Use nomes diferentes'}).waitFor();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('[data-page="Visão geral"]').click();
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1366,height:768});
  await page.screenshot({path:path.join(os.tmpdir(),'pulse-company-tabs.png')});
  await page.reload();await page.getByRole('heading',{name:'Seu negócio em foco.'}).waitFor();assert.equal(await page.getByRole('tab',{name:'Loja Sul',exact:true}).getAttribute('aria-selected'),'true');
  assert.deepEqual(errors,[]);console.log('PASS: quatro empresas, seleção persistente, edição, validação, isolamento de logo/dados e resoluções de desktop/celular.');
 }finally{await app.close();await fs.rm(temp,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});

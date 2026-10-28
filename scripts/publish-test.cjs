// User-authorized test publication: save source, preserve prior downloads, publish a prerelease.
// Uses Git LFS because release-asset authentication is unavailable in this environment.
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {spawnSync,spawn}=require('node:child_process');
const {verifyArtifacts,digest}=require('./verify-artifacts.cjs');const pkg=require('../package.json');
const root=path.resolve(__dirname,'..');const repo='maumau1902-bit/app-mrj';
function command(exe,args,input,quiet=false){const r=spawnSync(exe,args,{cwd:root,input,encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw new Error(`${exe} failed: ${(r.stderr||r.error?.message||'').slice(0,1200)}`);if(!quiet&&r.stderr)process.stderr.write(r.stderr);return r.stdout.trim()}
const git=(args,input)=>command('git',args,input);
const gh=(args,input)=>command('gh',args,input,true);
async function main(){
 const artifact=await verifyArtifacts(path.join(root,'release'),pkg.version);
 const sourcePaths=['README.md','.gitignore','.github','build','electron','electron-builder.cjs','index.html','package.json','package-lock.json','patches','public','scripts','src','tests','vite.config.js'];
 git(['fetch','origin']);
 git(['add','--',...sourcePaths]);
 if(git(['diff','--cached','--name-only']))git(['-c','user.name=Pulse Analytics','-c','user.email=pulse-analytics@users.noreply.github.com','commit','-m',`Release Pulse Analytics ${pkg.version}`]);
 const sourceCommit=git(['rev-parse','HEAD']);
 git(['push','origin',sourceCommit+':refs/heads/main']);
 const installer=path.join(root,'release',artifact.filename);
 const pointer=await new Promise((resolve,reject)=>{
  const child=spawn('git',['lfs','clean',artifact.filename],{cwd:root,stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>error+=d);child.on('error',reject);child.on('close',code=>code?reject(new Error(error)):resolve(output));fs.createReadStream(installer).pipe(child.stdin);
 });
 const oid=/oid sha256:([a-f0-9]{64})/.exec(pointer)?.[1];
 if(oid!==artifact.sha256)throw new Error('LFS pointer checksum mismatch');
 git(['lfs','push','--object-id','origin',oid]);
 const parent=git(['rev-parse','refs/remotes/origin/pulse-downloads']);
 const entries=new Map(git(['ls-tree',parent]).split('\n').filter(Boolean).map(line=>[line.split('\t')[1],line]));
 const download=`https://github.com/${repo}/raw/refs/heads/pulse-downloads/${artifact.filename}`;
 const notes=`Pulse Analytics ${pkg.version} — versão de teste para Windows 10/11 x64.\n\n[Baixar instalador](${download})\n\nAbas para cadastrar, editar e alternar empresas. Nome, identificação, cidade/UF, identificador Mithra, observações e logo próprios. A empresa selecionada permanece ao reabrir. Novas empresas começam sem dados; a demonstração pode ser ativada no cadastro.\n\nDados salvos neste dispositivo; login e conexão real ao Mithra ainda pendentes. Instalador sem assinatura digital; Windows pode indicar editor desconhecido. Atualização remota permanece desativada neste pacote de teste. Instale sobre a versão anterior, mantendo o perfil do aplicativo.\n\nValidados: testes unitários, desktop Electron, quatro empresas, persistência, isolamento de logos e resoluções de tela. A instalação desta versão ainda precisa de teste no Windows.\n\nSHA-256: ${artifact.sha256}\n`;
 const checksumName='SHA256SUMS.txt';
 const previous=git(['show',parent+':'+checksumName]);
 const sums=previous.split('\n').filter(line=>line&&!line.endsWith('  '+artifact.filename));sums.push(`${artifact.sha256}  ${artifact.filename}`);
 const documents=new Map([[artifact.filename,pointer],['.gitattributes','*.exe filter=lfs diff=lfs merge=lfs -text\n'],['README.md','# Pulse Analytics — downloads\n\n'+notes],['SHA256SUMS.txt',sums.join('\n')+'\n']]);
 for(const [name,content]of documents){const blob=git(['hash-object','-w','--stdin'],content);entries.set(name,`100644 blob ${blob}\t${name}`)}
 const tree=git(['mktree'],[...entries].sort(([a],[b])=>a.localeCompare(b,'en')).map(([,line])=>line+'\n').join(''));
 const commit=git(['-c','user.name=Pulse Analytics','-c','user.email=pulse-analytics@users.noreply.github.com','commit-tree',tree,'-p',parent],`Publish installer ${pkg.version}\n`);
 git(['push','origin',commit+':refs/heads/pulse-downloads']);
 const releases=JSON.parse(gh(['api','-H','Cache-Control: no-cache',`repos/${repo}/releases`]));
 const existing=releases.find(r=>r.tag_name==='v'+pkg.version);
 const data={tag_name:'v'+pkg.version,target_commitish:sourceCommit,name:`Pulse Analytics ${pkg.version} — versão de teste`,body:notes,draft:false,prerelease:true};
 const response=JSON.parse(gh(['api','--method',existing?'PATCH':'POST',existing?`repos/${repo}/releases/${existing.id}`:`repos/${repo}/releases`,'--input','-'],JSON.stringify(data)));
 if(response.draft!==false)throw new Error('Release did not publish');
 // Fetch from remote storage into an independent cache and verify the actual bytes.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pulse-published-check-'));const out=path.join(temp,'setup.exe');
 try{
  await new Promise((resolve,reject)=>{const child=spawn('git',['-c','lfs.storage='+path.join(temp,'lfs'),'lfs','smudge',artifact.filename],{cwd:root,stdio:['pipe','pipe','pipe']});const output=fs.createWriteStream(out);let error='';child.stdout.pipe(output);child.stderr.on('data',d=>error+=d);child.on('error',reject);let exit;child.on('close',code=>{exit=code;if(code)reject(new Error(error))});output.on('finish',()=>{if(exit===0)resolve();else child.once('close',code=>code===0?resolve():reject(new Error(error))) });output.on('error',reject);child.stdin.end(pointer)});
  if(await digest(out,'sha256','hex')!==artifact.sha256)throw new Error('Published download checksum mismatch');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
 fs.writeFileSync(path.join(root,'release','publication.json'),JSON.stringify({version:pkg.version,download,release:response.html_url,sha256:artifact.sha256,sourceCommit},null,2));
 console.log(JSON.stringify({download,release:response.html_url,sha256:artifact.sha256,verified:true},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

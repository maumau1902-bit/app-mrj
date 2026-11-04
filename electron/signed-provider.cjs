const {Provider}=require('electron-updater/out/providers/Provider');
const {NsisUpdater}=require('electron-updater');
const {ROOT,verifyCatalog,verifyInstaller}=require('./signed-catalog.cjs');
const publicKey=require('./update-public-key.cjs');
class SignedGithubProvider extends Provider{
 constructor(options,updater,runtime){super({...runtime,isUseMultipleRangeRequest:false});this.updater=updater;}
 async getLatestVersion(){
  const url=new URL(ROOT+'pulse-latest.json');url.searchParams.set('t',Date.now());
  const text=await this.httpRequest(url,{'Cache-Control':'no-cache'});
  if(!text||text.length>25000)throw new Error('Catálogo de atualização ausente ou excessivo');
  const info=verifyCatalog(JSON.parse(text),publicKey);this.updater.signedInfo=info;
  return {version:info.version,releaseName:'Pulse Analytics '+info.version,releaseDate:info.releaseDate,files:[{url:info.url,sha512:info.sha512,size:info.size}]};
 }
 resolveFiles(info){
  if(!this.updater.signedInfo||info.version!==this.updater.signedInfo.version)throw new Error('Catálogo não verificado');
  return [{url:new URL(this.updater.signedInfo.url),info:info.files[0]}];
 }
}
class SignedNsisUpdater extends NsisUpdater{
 constructor(options,app){
  super(options,app);
  this.disableWebInstaller=true;
  this.setFeedURL({provider:'custom',updateProvider:SignedGithubProvider});
 }
 async verifySignature(file){
  try{
   await verifyInstaller(file,this.signedInfo);
   // Retain Authenticode checking too when a Windows publisher is configured.
   return await super.verifySignature(file);
  }catch(error){return error.message;}
 }
 quitAndInstall(silent,forceRun){
  const file=this.installerPath;
  if(!file){this.emit('error',new Error('Nenhum instalador verificado'));return;}
  // Recheck even cached installers immediately before asking NSIS to run.
  this.verifySignature(file).then(error=>{
   if(error)this.emit('error',new Error(error));else super.quitAndInstall(silent,forceRun);
  }).catch(error=>this.emit('error',error));
 }
}
module.exports={SignedGithubProvider,SignedNsisUpdater};

const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {verifyArtifacts,digest}=require('./verify-artifacts.cjs');const {DOWNLOAD,verifyCatalog}=require('../electron/signed-catalog.cjs');const publicKey=require('../electron/update-public-key.cjs');
async function signUpdate(){
 const v=require('../package.json').version;const info=await verifyArtifacts('release',v);
 const key=fs.readFileSync(process.env.PULSE_UPDATE_SIGNING_KEY_PATH||'/workspace/.pulse-signing/update-private.pem');
 const payload=Buffer.from(JSON.stringify({schema:1,platform:'win32-x64',version:v,filename:info.filename,url:DOWNLOAD+info.filename,size:info.size,sha512:await digest(path.join('release',info.filename),'sha512','base64'),releaseDate:new Date().toISOString()}));
 const envelope={schema:1,payload:payload.toString('base64'),signature:crypto.sign(null,payload,key).toString('base64')};
 verifyCatalog(envelope,publicKey);const text=JSON.stringify(envelope,null,2)+'\n';
 fs.writeFileSync('release/pulse-latest.json',text);fs.writeFileSync(`release/pulse-${v}.json`,text);return text;
}
if(require.main===module)signUpdate().then(()=>console.log('Catálogo Ed25519 assinado e verificado.')).catch(e=>{console.error(e.message);process.exitCode=1});module.exports={signUpdate};

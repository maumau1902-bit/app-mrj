const crypto=require('node:crypto'),fs=require('node:fs');
const ROOT='https://raw.githubusercontent.com/maumau1902-bit/app-mrj/pulse-downloads/';
const DOWNLOAD='https://github.com/maumau1902-bit/app-mrj/raw/refs/heads/pulse-downloads/';
function verifyCatalog(envelope,publicKey){
 if(!envelope||envelope.schema!==1||typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||envelope.payload.length>15000)throw new Error('Catálogo inválido');
 const bytes=Buffer.from(envelope.payload,'base64');
 if(!crypto.verify(null,bytes,publicKey,Buffer.from(envelope.signature,'base64')))throw new Error('Assinatura de atualização inválida');
 const data=JSON.parse(bytes.toString('utf8'));
 if(data.schema!==1||data.platform!=='win32-x64'||!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error('Versão/plataforma inválida');
 const name=`Pulse-Analytics-Setup-${data.version}-x64.exe`;
 if(data.filename!==name||data.url!==DOWNLOAD+name||!Number.isSafeInteger(data.size)||data.size<1000||data.size>1024**3||!/^[A-Za-z0-9+/]{86}==$/.test(data.sha512))throw new Error('Arquivo de atualização inválido');
 return Object.freeze(data);
}
async function verifyInstaller(file,info){
 if(!info||fs.statSync(file).size!==info.size)throw new Error('Tamanho da atualização não confere');
 const hash=crypto.createHash('sha512');for await(const block of fs.createReadStream(file))hash.update(block);
 if(hash.digest('base64')!==info.sha512)throw new Error('SHA-512 da atualização não confere');
}
module.exports={ROOT,DOWNLOAD,verifyCatalog,verifyInstaller};

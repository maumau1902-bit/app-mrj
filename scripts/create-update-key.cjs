const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=process.env.PULSE_UPDATE_SIGNING_KEY_PATH||'/workspace/.pulse-signing/update-private.pem';
const publicFile=path.resolve(__dirname,'../electron/update-public-key.cjs');
if(!fs.existsSync(file)){
 if(fs.existsSync(publicFile))throw new Error('A chave privada original está ausente. Restaure a chave; não troque a identidade das atualizações.');
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const key=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(file,key.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
}
const pem=crypto.createPublicKey(fs.readFileSync(file)).export({type:'spki',format:'pem'});
if(fs.existsSync(publicFile)&&require(publicFile)!==pem)throw new Error('A chave privada não corresponde à chave pública já distribuída.');
fs.writeFileSync(publicFile,'// Public trust root. Never put the private signing key in this repository.\nmodule.exports = '+JSON.stringify(pem)+';\n');
console.log('Identidade Ed25519 de atualização preparada. Chave privada permanece fora do repositório.');

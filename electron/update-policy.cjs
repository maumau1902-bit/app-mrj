const crypto=require('node:crypto');
function updatePolicy({packaged,platform,publicKey}){
 if(!packaged||platform!=='win32')return {enabled:false,disabledReason:'Atualizações internas estão disponíveis no aplicativo Windows instalado.'};
 try{if(crypto.createPublicKey(publicKey).asymmetricKeyType!=='ed25519')throw new Error();return {enabled:true};}
 catch{return {enabled:false,disabledReason:'A identidade de assinatura das atualizações está ausente ou inválida.'};}
}
module.exports={updatePolicy};

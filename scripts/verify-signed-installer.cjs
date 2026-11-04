const fs=require('node:fs');const{verifyCatalog,verifyInstaller}=require('../electron/signed-catalog.cjs');const key=require('../electron/update-public-key.cjs');
verifyInstaller(process.argv[2],verifyCatalog(JSON.parse(fs.readFileSync(process.argv[3],'utf8')),key)).then(()=>console.log('Assinatura Ed25519 e SHA-512 válidos.')).catch(e=>{console.error(e.message);process.exitCode=1});

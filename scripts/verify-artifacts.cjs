const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { parse } = require('yaml');
async function digest(file, algorithm, encoding) {
  const hash = crypto.createHash(algorithm);
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest(encoding);
}
async function verifyArtifacts(directory, version) {
  const root = path.resolve(directory);
  const info = parse(fs.readFileSync(path.join(root, 'latest.yml'), 'utf8'));
  const filename = `Pulse-Analytics-Setup-${version}-x64.exe`;
  if (info.version !== version || info.path !== filename || info.files?.length !== 1 || info.files[0].url !== filename) throw new Error('Manifesto não corresponde à versão/instalador esperados.');
  const target = path.join(root, filename);
  if (fs.lstatSync(target).isSymbolicLink() || fs.lstatSync(target+'.blockmap').isSymbolicLink()) throw new Error('Artefatos não podem ser links simbólicos.');
  const size = fs.statSync(target).size;
  const sha512 = await digest(target, 'sha512', 'base64');
  if (size !== info.files[0].size || sha512 !== info.files[0].sha512 || sha512 !== info.sha512) throw new Error('Integridade SHA-512/tamanho do instalador inválida.');
  const header = Buffer.alloc(64);const fd = fs.openSync(target,'r');
  try { fs.readSync(fd, header, 0, 64, 0); } finally { fs.closeSync(fd); }
  if (header.toString('ascii',0,2) !== 'MZ') throw new Error('Artefato não é um executável Windows.');
  const blocks = JSON.parse(zlib.gunzipSync(fs.readFileSync(target+'.blockmap')));
  if (blocks.version !== '2' && blocks.version !== 2) throw new Error('Formato de blockmap incompatível.');
  if (blocks.files?.length !== 1 || blocks.files[0].offset !== 0) throw new Error('Estrutura de blockmap inesperada.');
  const file = blocks.files[0];
  if (!file.sizes?.length || file.sizes.length !== file.checksums?.length || file.sizes.some(n=>!Number.isSafeInteger(n)||n<=0) || file.sizes.reduce((a,b)=>a+b,0)!==size) throw new Error('Blocos não correspondem ao tamanho do instalador.');
  const sha256 = await digest(target,'sha256','hex');
  return { filename, size, sha256, blocks: file.sizes.length };
}
if (require.main === module) verifyArtifacts(process.argv[2] || 'release', require('../package.json').version).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports = { verifyArtifacts, digest };

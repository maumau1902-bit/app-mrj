// Integration test against the real electron-updater downloader, using loopback HTTP ranges.
// It reconstructs a real NSIS package; it does not install it or bypass Windows signature checks.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { Transform } = require('node:stream');
const { HttpExecutor, CancellationToken } = require('builder-util-runtime');
const { GenericDifferentialDownloader } = require('electron-updater/out/differentialDownloader/GenericDifferentialDownloader');
const { digest } = require('./verify-artifacts.cjs');
class LoopbackExecutor extends HttpExecutor {
  createRequest(options, callback) { return http.request({...options,agent:false},callback); }
}
async function main() {
  const [oldFile,newFile] = process.argv.slice(2).map(p=>path.resolve(p));
  if (!oldFile || !newFile || oldFile === newFile) throw new Error('Informe dois instaladores distintos: anterior e novo.');
  const oldMap=JSON.parse(zlib.gunzipSync(await fsp.readFile(oldFile+'.blockmap')));
  const newMap=JSON.parse(zlib.gunzipSync(await fsp.readFile(newFile+'.blockmap')));
  const info={size:(await fsp.stat(newFile)).size,sha512:await digest(newFile,'sha512','base64')};
  let transferred=0,requests=0,tamper=false;
  const server=http.createServer((request,response)=>{
    const range=/^bytes=(\d+)-(\d+)$/.exec(request.headers.range || '');
    if (request.url!=='/installer.exe' || !range) { response.writeHead(400);response.end();return; }
    const start=Number(range[1]),end=Number(range[2]);
    if (start>end || end>=info.size) { response.writeHead(416);response.end();return; }
    requests++;transferred+=end-start+1;
    response.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});
    const stream=fs.createReadStream(newFile,{start,end});
    if (tamper) stream.pipe(new Transform({transform(chunk,_encoding,callback){chunk[0]^=1;callback(null,chunk)}})).pipe(response);
    else stream.pipe(response);
  });
  const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'pulse-differential-'));
  const reconstructed=path.join(temp,'reconstructed.exe');
  const logger={info:message=>{if(!message.includes('http:'))console.log(message)},warn:()=>{},error:console.error};
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const downloader=new GenericDifferentialDownloader(info,new LoopbackExecutor(),{oldFile,newFile:reconstructed,newUrl:new URL(`http://127.0.0.1:${server.address().port}/installer.exe`),logger,requestHeaders:null,isUseMultipleRangeRequest:false,cancellationToken:new CancellationToken()});
    await downloader.download(oldMap,newMap);
    assert.equal(await digest(reconstructed,'sha512','base64'),info.sha512);
    assert.ok(requests>0,'O teste deve executar pedidos HTTP reais.');
    assert.ok(transferred<info.size,'O teste deve reutilizar blocos da versão anterior.');
    const result={result:'PASS',fullBytes:info.size,downloadedBytes:transferred,reusedPercent:Math.round((1-transferred/info.size)*10000)/100,rangeRequests:requests,sha512:'matched'};
    tamper=true;
    const corrupted=new GenericDifferentialDownloader(info,new LoopbackExecutor(),{oldFile,newFile:path.join(temp,'corrupted.exe'),newUrl:new URL(`http://127.0.0.1:${server.address().port}/installer.exe`),logger,requestHeaders:null,isUseMultipleRangeRequest:false,cancellationToken:new CancellationToken()});
    await assert.rejects(corrupted.download(oldMap,newMap),/checksum mismatch/i);
    result.corruptedDownload='rejected';
    console.log(JSON.stringify(result,null,2));
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await fsp.rm(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

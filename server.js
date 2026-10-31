const https=require("https"),fs=require("fs"),path=require("path");
const ROOT=__dirname,PORT=Number(process.env.PORT||8443);
const cert=path.join(ROOT,"certs","fallguard.pem"),key=path.join(ROOT,"certs","fallguard-key.pem");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};
if(!fs.existsSync(cert)||!fs.existsSync(key)){console.error("Certificate missing. Run setup-local.ps1 first.");process.exit(1);}
https.createServer({cert:fs.readFileSync(cert),key:fs.readFileSync(key)},(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,"https://localhost").pathname);}catch{res.writeHead(400);return res.end("Bad request");}
 let file=path.resolve(ROOT,"."+pathname);
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end("Forbidden");}
 if(pathname==="/")file=path.join(ROOT,"index.html");
 try{if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");}catch{}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end("Not found");}res.writeHead(200,{"Content-Type":types[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});res.end(data);});
}).listen(PORT,"0.0.0.0",()=>{
 const nets=require("os").networkInterfaces();const ips=Object.values(nets).flat().filter(x=>x&&x.family==="IPv4"&&!x.internal).map(x=>x.address);
 console.log("\nFallGuard local HTTPS server running.");
 console.log("PC: https://localhost:"+PORT);
 ips.forEach(ip=>console.log("Phone: https://"+ip+":"+PORT));
 console.log("Keep this window open. Ctrl+C stops the server.\n");
});
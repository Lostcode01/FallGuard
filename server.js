const https=require("https"),fs=require("fs"),path=require("path"),os=require("os");
const ROOT=__dirname,PORT=Number(process.env.PORT||8443);
const cert=path.join(ROOT,"certs","fallguard.pem"),key=path.join(ROOT,"certs","fallguard-key.pem");
const publicFiles={"/": "index.html","/index.html":"index.html","/style.css":"style.css","/app.js":"app.js","/ble.js":"ble.js"};
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
if(!fs.existsSync(cert)||!fs.existsSync(key)){console.error("Certificate missing. Run setup-local.ps1 first.");process.exit(1);}
https.createServer({cert:fs.readFileSync(cert),key:fs.readFileSync(key)},(req,res)=>{
 let pathname;try{pathname=new URL(req.url,"https://localhost").pathname;}catch{res.writeHead(400);return res.end("Bad request");}
 const name=publicFiles[pathname];
 if(!name){res.writeHead(404);return res.end("Not found");}
 fs.readFile(path.join(ROOT,name),(err,data)=>{
  if(err){res.writeHead(404);return res.end("Not found");}
  res.writeHead(200,{"Content-Type":types[path.extname(name)],"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(data);
 });
}).listen(PORT,"0.0.0.0",()=>{
 const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==="IPv4"&&!x.internal).map(x=>x.address);
 console.log("\nFallGuard local HTTPS server running.");
 console.log("PC: https://localhost:"+PORT);
 ips.forEach(ip=>console.log("Phone: https://"+ip+":"+PORT));
 console.log("Only the dashboard's public web files are served; private certificates and firmware are not exposed.");
 console.log("Keep this window open. Ctrl+C stops the server.\n");
});
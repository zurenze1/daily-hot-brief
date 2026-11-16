import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,PRESETS,normalizeConfig,dayAndTime} from './config.mjs';
import {Storage} from './storage.mjs';
import {Engine} from './engine.mjs';
import {modelStatus,callModel} from './model.mjs';
import {normalizeEditorial} from './schema.mjs';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const validDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export async function createApp({dir=DATA,port=Number(process.env.PORT||4897),engineOptions={},schedulerInterval=30000}={}){
 const store=new Storage(dir);await store.init();const engine=new Engine(store,engineOptions);const csrf=randomBytes(32).toString('hex');let config=await store.read('config.json');if(config)config=normalizeConfig(config);
 const refreshConfig=async()=>{if(!engine.running){const saved=await store.read('config.json');config=saved?normalizeConfig(saved):null;}};
 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 async function body(req){let s='';for await(const c of req){s+=c;if(s.length>1024*1024)throw Error('请求超过1MB');}return JSON.parse(s||'{}');}
 const server=http.createServer(async(req,res)=>{try{
  const host=req.headers.host||'',local=/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);if(!local)return reply(res,403,{error:'只接受本机地址，未开放远程访问'});
  const url=new URL(req.url,'http://'+host),p=url.pathname;
  if(req.headers.origin&&req.headers.origin!==url.origin)return reply(res,403,{error:'来源不匹配'});
  if(p.startsWith('/api/')){
   if(!['GET','HEAD'].includes(req.method)&&(!/^application\/json(?:;|$)/.test(req.headers['content-type']||'')||req.headers['x-brief-csrf']!==csrf))return reply(res,403,{error:'请从当前工具页面操作'});
   if(p==='/api/state'&&req.method==='GET'){await refreshConfig();const editions=await store.editions();return reply(res,200,{version:'2.0.0',csrf,config,presets:PRESETS,editions:editions.slice(0,90),job:engine.running||await store.read('last-job.json'),clock:config?dayAndTime(config):null});}
   if(p==='/api/job'&&req.method==='GET')return reply(res,200,{job:engine.running||await store.read('last-job.json')});
   if(p==='/api/config'&&req.method==='PUT'){if(engine.running)throw Object.assign(Error('请等待或取消当前任务后修改配置'),{status:409});const next=normalizeConfig(await body(req)),release=await store.lock();try{const prior=await store.read('config.json');if(prior)await store.write('config.previous.json',prior);await store.write('config.json',next);config=next;}finally{await release();}return reply(res,200,{ok:true,config});}
   if(p==='/api/run'&&req.method==='POST'){await refreshConfig();if(!config)throw Error('请先完成行业和模型设置');return reply(res,202,{job:await engine.start(config)});}
   if(p==='/api/cancel'&&req.method==='POST')return reply(res,200,engine.cancel());
   if(p==='/api/model/test'&&req.method==='POST'){if(engine.running)throw Error('正在运行，请稍后测试');const input=await body(req),c=input.industry?normalizeConfig(input):config;if(!c)throw Error('请先填写配置');const status=modelStatus(c);if(!status.installed||status.loggedIn===false)throw Error(status.label);const output=await callModel(c,{prompt:'连接测试，仅返回JSON：{"ok":true}。不要调用工具或读取其他资料。',schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},dir:path.join(store.dir,'model'),timeoutMs:120000});if(output.ok!==true)throw Error('AI未返回预期测试结果');return reply(res,200,{ok:true,status:'模型真实响应通过；会使用本人模型额度'});}
   const match=/^\/api\/editions\/(\d{4}-\d{2}-\d{2})\/news\/([\w-]+)$/.exec(p);
   if(match&&req.method==='PATCH'){if(!validDay(match[1]))throw Error('日期无效');if(engine.running)throw Object.assign(Error('请等待生成完成后编辑'),{status:409});const b=await body(req);const e=await store.editEdition(match[1],b.editionId,b.revision,async edition=>{const n=edition.news.find(x=>x.id===match[2]);if(!n)throw Error('条目不存在');n.editorial={...normalizeEditorial(b.editorial),reviewedAt:new Date().toISOString()};if(edition.news.filter(x=>x.editorial.priority==='优先').length>3)throw Error('每期最多3个优先题');});return reply(res,200,{edition:e});}
   if(p==='/api/health'&&req.method==='GET'){await refreshConfig();return reply(res,200,{ok:true,configured:!!config,version:'2.0.0'});}
   return reply(res,404,{error:'接口不存在'});
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const web=path.join(ROOT,'web');let pathname=decodeURIComponent(p);if(pathname.endsWith('/'))pathname+='index.html';const file=await fs.realpath(path.resolve(web,'.'+pathname));if(!file.startsWith(web+path.sep))throw Error('不允许的文件路径');const stat=await fs.stat(file);if(!stat.isFile())throw Error('文件不存在');
  const content=req.method==='HEAD'?undefined:await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Length':stat.size});res.end(content);
 }catch(e){reply(res,e.status||400,{error:e.message});}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 let ticking=false;const tick=async()=>{if(ticking)return;ticking=true;try{await refreshConfig();await engine.tick(config);}catch(e){await store.write('schedule-error.json',{message:e.message,at:new Date().toISOString()});}finally{ticking=false;}};
 const timer=setInterval(tick,schedulerInterval);timer.unref();
 return {server,store,engine,address:'http://127.0.0.1:'+server.address().port,async close(){clearInterval(timer);engine.cancel();if(engine.task)await engine.task;await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createApp();console.log('每日热点早报 v2：'+app.address+'\n运行数据保存在本机，未加入公开仓库。自动日更需保持服务运行和联网。');
 for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>app.close().then(()=>process.exit(0)));
}

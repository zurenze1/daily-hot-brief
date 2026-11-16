import fs from 'node:fs/promises';
import {normalizeConfig,DATA,PRESETS,dayAndTime} from '../server/config.mjs';
import {Storage} from '../server/storage.mjs';
import {modelStatus} from '../server/model.mjs';
import {Engine} from '../server/engine.mjs';
const [action,...args]=process.argv.slice(2),store=new Storage();await store.init();
try{
 if(action==='setup'){
  const at=args.indexOf('--file');if(at<0||!args[at+1])throw Error('打开npm start的设置表单，或由安装AI使用：npm run setup -- --file 本人配置.json。无需使用者手填JSON。');
  const config=normalizeConfig(JSON.parse(await fs.readFile(args[at+1],'utf8')));const release=await store.lock();try{const old=await store.read('config.json');if(old)await store.write('config.previous.json',old);await store.write('config.json',config);}finally{await release();}console.log(JSON.stringify({ok:true,industry:config.industry,target:config.target,schedule:config.schedule,data:DATA}));
 }else if(action==='doctor'){
  const config=await store.read('config.json');console.log(JSON.stringify({node:process.version,configured:!!config,industry:config?.industry||null,target:config?.target||null,clock:config?dayAndTime(config):null,model:modelStatus(config),data:DATA},null,2));
 }else if(action==='run'){
  const config=await store.read('config.json');if(!config)throw Error('请先完成设置');const engine=new Engine(store);await engine.start(normalizeConfig(config),'命令行运行');const t=setInterval(()=>console.error(engine.running?.stage||''),15000);try{await engine.task;}finally{clearInterval(t);}const job=await store.read('last-job.json');console.log(JSON.stringify(job,null,2));if(['failed','cancelled'].includes(job.status))process.exitCode=1;
 }else if(action==='presets')console.log(JSON.stringify(PRESETS,null,2));else throw Error('可用命令：setup、doctor、run、presets');
}catch(e){console.error(e.message);process.exitCode=1;}

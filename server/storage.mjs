import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DATA} from './config.mjs';
export class Storage{
 constructor(dir=DATA){this.dir=dir;this.editionQueue=Promise.resolve();}
 async init(){await fs.mkdir(this.dir,{recursive:true,mode:0o700});await fs.mkdir(path.join(this.dir,'editions'),{recursive:true,mode:0o700});}
 async read(name,fallback=null){try{return JSON.parse(await fs.readFile(path.join(this.dir,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('本机保存文件损坏，请保留原文件并查看恢复说明');}}
 async write(name,value){const f=path.join(this.dir,name);await fs.mkdir(path.dirname(f),{recursive:true,mode:0o700});const temp=f+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});await fs.rename(temp,f);}
 async editions(){const files=(await fs.readdir(path.join(this.dir,'editions'))).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x));const out=[];for(const f of files)out.push(await this.read('editions/'+f));return out.sort((a,b)=>b.day.localeCompare(a.day));}
 async saveEdition(e){if(!/^\d{4}-\d{2}-\d{2}$/.test(e.day))throw Error('日报日期无效');const old=await this.read('editions/'+e.day+'.json');if(old)await this.write('versions/'+e.day+'/'+Date.now()+'-'+randomUUID()+'.json',old);await this.write('editions/'+e.day+'.json',e);}
 async editEdition(day,id,revision,mutate){const run=this.editionQueue.then(async()=>{const release=await this.lock();try{const e=await this.read('editions/'+day+'.json');if(!e||e.id!==id||e.revision!==revision)throw Object.assign(Error('资料已有新版本，请刷新后再编辑'),{status:409});await mutate(e);e.revision++;e.editedAt=new Date().toISOString();await this.saveEdition(e);return e;}finally{await release();}});this.editionQueue=run.catch(()=>{});return run;}
 async lock(){const f=path.join(this.dir,'.run.lock');try{const h=await fs.open(f,'wx',0o600);await h.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));await h.close();}catch(e){if(e.code!=='EEXIST')throw e;let l;try{l=JSON.parse(await fs.readFile(f,'utf8'));}catch{throw Error('运行锁不可读，请先核实是否有任务运行');}try{process.kill(l.pid,0);throw Object.assign(Error('已有早报任务运行，请勿重复启动'),{status:409});}catch(check){if(check.code!=='ESRCH')throw check;}await fs.unlink(f);return this.lock();}return async()=>{await fs.unlink(f).catch(()=>{});};}
}

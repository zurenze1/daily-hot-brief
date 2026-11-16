import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {callModel} from './model.mjs';
import {collect,analysisPrompt} from './collector.mjs';
import {editionSchema,validateGeneration} from './schema.mjs';
import {dayAndTime} from './config.mjs';
export class Engine{
 constructor(store,{model,collector=collect}={}){this.store=store;this.model=model;this.collector=collector;this.running=null;this.abort=null;}
 async start(config,reason='手动运行'){
  if(this.running)throw Object.assign(Error('已有任务运行，可查看进度或取消'),{status:409});const release=await this.store.lock();const id=randomUUID(),clock=dayAndTime(config);const job={id,status:'running',reason,day:clock.day,timezone:clock.timezone,startedAt:new Date().toISOString(),stage:'准备采集',events:[]};this.abort=new AbortController();this.running=job;await this.store.write('last-job.json',job);
  const log=stage=>{job.stage=stage;job.events.push({at:new Date().toISOString(),stage});job.events=job.events.slice(-200);};
  const task=(async()=>{try{
   const model=request=>this.model?this.model(request):callModel(config,{...request,dir:path.join(this.store.dir,'model')});
   const result=await this.collector(config,{model,signal:this.abort.signal,log});job.candidates=result.candidates;job.read=result.evidence.length;job.issues=result.issues;
   if(!result.evidence.length)throw Error('未取得足够可读的公开资料；查看来源失败原因后重试，不生成假早报');
   if(this.abort.signal.aborted)throw Error('任务已取消');log('AI生成观点与博主切口');
   const raw=await model({prompt:analysisPrompt(config,result.evidence),schema:editionSchema,search:false,signal:this.abort.signal});if(this.abort.signal.aborted)throw Error('任务已取消');const content=validateGeneration(raw,result.evidence,config);
   if(!content.news.length)throw Error('AI判断现有资料不适合账号，未生成条目。请调整来源或主题后重试');
   const edition={id:randomUUID(),revision:1,day:clock.day,timezone:clock.timezone,generatedAt:new Date().toISOString(),scheduledFor:reason==='自动日更'?config.schedule.time:null,industry:config.industry,audience:config.audience,categories:config.categories,target:config.target,...content,status:content.news.length<config.target?'partial':'complete',issues:result.issues,read:result.evidence.length};
   // Store evidence separately from publication code; never include it in Git or public previews.
   await this.store.write('evidence/'+edition.day+'/'+edition.id+'.json',result.evidence);await this.store.saveEdition(edition);job.status=edition.status;job.saved=content.news.length;job.editionId=edition.id;log('已保存 '+content.news.length+' / '+config.target+' 条，观点与切口已校验');
  }catch(e){job.status=this.abort.signal.aborted?'cancelled':'failed';job.error=e.message;log(job.status==='cancelled'?'任务已取消':'本次未完成，旧早报保留');}finally{job.finishedAt=new Date().toISOString();try{await this.store.write('last-job.json',job);}catch{job.status='failed';job.error='无法保存运行回执，请检查磁盘空间与目录权限';}finally{await release();this.running=null;this.abort=null;}}})();
  this.task=task;return {...job};
 }
 cancel(){this.abort?.abort();return {cancelRequested:!!this.abort};}
 async tick(config,at=new Date()){
  if(!config?.schedule.enabled||this.running)return false;const clock=dayAndTime(config,at);if(clock.time<config.schedule.time)return false;
  const attempts=await this.store.read('schedule-attempts.json',{});if(attempts[clock.day])return false;attempts[clock.day]={at:at.toISOString(),time:config.schedule.time,timezone:clock.timezone};await this.store.write('schedule-attempts.json',Object.fromEntries(Object.entries(attempts).sort().slice(-90)));
  try{await this.start(config,'自动日更');return true;}catch(e){await this.store.write('schedule-error.json',{at:new Date().toISOString(),message:e.message});return false;}
 }
}

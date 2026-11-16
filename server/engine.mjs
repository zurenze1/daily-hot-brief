import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {callModel} from './model.mjs';
import {collect,analysisPrompt} from './collector.mjs';
import {editionSchema,validateGeneration} from './schema.mjs';
import {dayAndTime,analysisBatches} from './config.mjs';
export class Engine{
 constructor(store,{model,collector=collect}={}){this.store=store;this.model=model;this.collector=collector;this.running=null;this.abort=null;}
 async start(config,reason='手动运行'){
  if(this.running)throw Object.assign(Error('已有任务运行，可查看进度或取消'),{status:409});const release=await this.store.lock();const id=randomUUID(),clock=dayAndTime(config);const job={id,status:'running',reason,day:clock.day,timezone:clock.timezone,startedAt:new Date().toISOString(),stage:'准备采集',events:[]};this.abort=new AbortController();this.running=job;await this.store.write('last-job.json',job);
  const log=stage=>{job.stage=stage;job.events.push({at:new Date().toISOString(),stage});job.events=job.events.slice(-200);};
  const task=(async()=>{try{
   const model=request=>this.model?this.model(request):callModel(config,{...request,dir:path.join(this.store.dir,'model')});
   const result=await this.collector(config,{model,signal:this.abort.signal,log});job.candidates=result.candidates;job.read=result.evidence.length;job.issues=result.issues;
   if(!result.evidence.length)throw Error('未取得足够可读的公开资料；查看来源失败原因后重试，不生成假早报');
   if(this.abort.signal.aborted)throw Error('任务已取消');
   const limit=Math.min(6000,Math.floor(120000/result.evidence.length));result.evidence=result.evidence.map(e=>({...e,body:e.body.slice(0,limit),readScope:e.readScope+(e.body.length>limit?'；本次AI分析使用前'+limit+'字符':'')}));
   const batches=analysisBatches(config),news=[],notes=[],used=new Set(),titles=new Set();
   for(const [index,batch] of batches.entries()){
    const available=result.evidence.filter(e=>!used.has(e.id));if(!available.length)break;log('AI生成观点与博主切口 '+(index+1)+' / '+batches.length);
    try{const raw=await model({prompt:analysisPrompt(batch,available),schema:editionSchema,search:false,signal:this.abort.signal});if(this.abort.signal.aborted)throw Error('任务已取消');const part=validateGeneration(raw,available,batch);if(part.note)notes.push(part.note);for(const n of part.news){if(titles.has(n.title))continue;const primary=n.evidenceIds[0];if(used.has(primary))continue;for(const id of n.evidenceIds)used.add(id);titles.add(n.title);news.push({...n,id:'n'+(news.length+1)});}}
    catch(e){if(this.abort.signal.aborted)throw e;result.issues.push({kind:'analysis',message:e.message});notes.push('部分内容分析未完成：'+e.message);break;}
   }
   const priorities=news.filter(n=>n.editorial.priority==='优先');if(priorities.length>3){log('比较全期候选，选择最多3个优先切口');let ids=[];try{const ranked=await model({prompt:'只根据给定候选，为'+config.industry+'账号的'+config.audience+'选出最值得先拍的最多3个id。依据受众相关性、证据完整度、切口具体性和时效，不按栏目顺序。不要添加候选，不添加称呼。候选：'+JSON.stringify(priorities.map(n=>({id:n.id,title:n.title,...n.editorial}))),schema:{type:'object',properties:{ids:{type:'array',items:{type:'string'}}},required:['ids'],additionalProperties:false},search:false,signal:this.abort.signal});if(!Array.isArray(ranked.ids)||ranked.ids.length>3||new Set(ranked.ids).size!==ranked.ids.length||ranked.ids.some(id=>!priorities.some(n=>n.id===id)))throw Error('优先题排序结果无效');ids=ranked.ids;}catch(e){if(this.abort.signal.aborted)throw e;result.issues.push({kind:'priority',message:e.message});notes.push('优先题比较未完成，本期暂保留为备选，可在界面手动选择。');}for(const n of priorities)if(!ids.includes(n.id)){n.editorial.priority='备选';n.editorial.reason+=' 本期优先题最多3条，此条先作备选。';}}
   const content={news,note:notes.join('\n\n')};
   if(!content.news.length)throw Error('AI判断现有资料不适合账号，未生成条目。请调整来源或主题后重试');
   const edition={id:randomUUID(),revision:1,day:clock.day,timezone:clock.timezone,generatedAt:new Date().toISOString(),scheduledFor:reason==='自动日更'?config.schedule.time:null,industry:config.industry,audience:config.audience,categories:config.categories,target:config.target,...content,status:content.news.length<config.target||result.issues.some(x=>['analysis','priority'].includes(x.kind))?'partial':'complete',issues:result.issues,read:result.evidence.length};
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

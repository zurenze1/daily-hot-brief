export const CHANNELS=[['all','全部'],['finance','财经'],['people','人物'],['culture','时尚界'],['apparel','服装'],['ai','AI'],['other','其他']];
export const MAX_FILE_BYTES=5*1024*1024;
const allowed=new Set(CHANNELS.map(x=>x[0]).filter(x=>x!=='all'));
const text=(v,max=4000)=>{if(v===undefined||v===null)return '';if(typeof v!=='string')throw Error('文字字段必须是字符串');if(v.length>max)throw Error('单个文字字段过长');return v.trim();};
export function validDay(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
export function sourceURL(v){
 try{const u=new URL(v);const h=u.hostname.toLowerCase();if(!['http:','https:'].includes(u.protocol)||u.username||u.password||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||h.includes(':')||/^(?:0|10|127)\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(?:1[6-9]|2\d|3[01])\./.test(h))return '';if([...u.searchParams.keys()].some(k=>/^(?:api[_-]?key|access[_-]?token|token|password|authorization)$/i.test(k)))return '';return u.href;}catch{return '';}
}
export function normalizeEdition(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!validDay(raw.day))throw Error('每一期都需要有效日期 day，例如 2026-01-02');
 if(!Array.isArray(raw.news)||raw.news.length>5000)throw Error('news 必须是数组，单期最多5000条');
 const news=raw.news.map((item,index)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('新闻条目必须是对象');
  const title=text(item.title,500);if(!title)throw Error('新闻标题不能为空');
  const channel=allowed.has(item.channel)?item.channel:'other';
  const facts=Array.isArray(item.facts)?item.facts.map(x=>text(x,4000)).join('\n'):text(item.facts??item.summary,12000);
  const sources=(Array.isArray(item.sources)?item.sources:[]).slice(0,20).flatMap(s=>{if(!s||typeof s!=='object')return [];const url=sourceURL(s.url);return url?[{name:text(s.name??s.title,200)||new URL(url).hostname,url}]:[];});
  return {id:raw.day+':'+index,day:raw.day,channel,title,category:text(item.category,200),person:text(item.person,200),facts,analysis:text(item.analysis,12000),publishedAt:text(item.publishedAt,100),sources};
 });
 return {day:raw.day,generatedAt:text(raw.generatedAt,100),news};
}
export function parseImport(raw){const input=Array.isArray(raw)?raw:(Array.isArray(raw?.editions)?raw.editions:[raw]);if(input.length>366)throw Error('一次最多导入366期');const editions=input.map(normalizeEdition);if(editions.reduce((n,e)=>n+e.news.length,0)>10000)throw Error('一次最多导入10000条');return editions;}
export function mergeEditions(current,incoming){const map=new Map(current.map(e=>[e.day,e]));for(const e of incoming)map.set(e.day,e);const result=[...map.values()].sort((a,b)=>b.day.localeCompare(a.day));if(result.reduce((n,e)=>n+e.news.length,0)>10000)throw Error('页面内最多保留10000条，请清空后重新导入');return result;}
export function selectItems(editions,{day='',channel='all',query=''}={}){const q=query.trim().toLocaleLowerCase();return editions.filter(e=>!day||e.day===day).flatMap(e=>e.news).filter(n=>(channel==='all'||n.channel===channel)&&(!q||[n.title,n.facts,n.analysis,n.person,n.category,...n.sources.map(s=>s.name)].join('\n').toLocaleLowerCase().includes(q)));}

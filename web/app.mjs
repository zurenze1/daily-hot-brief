import {CHANNELS,MAX_FILE_BYTES,parseImport,mergeEditions,selectItems} from './data.mjs';
import {demoEdition} from './demo.mjs';
const $=s=>document.querySelector(s);
let editions=[],channel='all',demo=false;
const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function message(text,error=false){const e=$('#message');e.textContent=text;e.className=error?'error':'';}
function render(){
 const day=$('#date-filter').value,query=$('#search').value,items=selectItems(editions,{day,channel,query});
 const total=editions.reduce((n,e)=>n+e.news.length,0);$('#issue-date').textContent=editions[0]?.day||'尚未导入';$('#issue-meta').textContent=editions.length?(demo?'虚构示例 · 不是新闻':editions.length+' 期 · '+total+' 条'):'不预置新闻 · 无需账号';
 $('#clear-button').disabled=!editions.length;$('#empty').hidden=!!editions.length;$('#no-results').hidden=!editions.length||!!items.length;
 $('#section-title').textContent=CHANNELS.find(x=>x[0]===channel)[1]+'线索';$('#result-count').textContent=items.length+' 条';
 const nav=$('#channels');nav.replaceChildren();for(const [key,name] of CHANNELS){const b=element('button','channel',name);b.type='button';b.setAttribute('aria-pressed',String(key===channel));const n=selectItems(editions,{day,channel:key}).length;b.append(element('span','channel-count',String(n)));b.onclick=()=>{channel=key;render();};nav.append(b);}
 const host=$('#news-list');host.replaceChildren();for(const [index,n] of items.entries()){
  const card=element('article','news-card');card.dataset.channel=n.channel;
  const top=element('div','card-top');top.append(element('span','category',CHANNELS.find(x=>x[0]===n.channel)[1]),element('time','day',n.day));
  card.append(top,element('span','ordinal',String(index+1).padStart(2,'0')),element('h3','',n.title));
  card.append(element('p','summary',n.facts||'此条未提供摘要，请展开详情或查看原文。'));
  const details=element('details','detail');details.append(element('summary','','查看详情与来源'));
  if(n.person)details.append(element('p','detail-meta','人物：'+n.person));
  if(n.category)details.append(element('p','detail-meta','类别：'+n.category));
  if(n.publishedAt)details.append(element('p','detail-meta','原标注时间：'+n.publishedAt));
  if(n.facts){details.append(element('h4','','资料摘要'),element('p','full-text',n.facts));}
  if(n.analysis){details.append(element('h4','','整理者的思考'),element('p','full-text',n.analysis));}
  const links=element('div','source-links');if(!n.sources.length)links.append(element('p','detail-meta','未提供可打开的公开来源。'));
  for(const s of n.sources){const a=element('a','source-link',s.name+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  details.append(links);card.append(details);host.append(card);
 }
}
function updateDates(){const selected=$('#date-filter').value,s=$('#date-filter');s.replaceChildren();const all=element('option','','全部日期');all.value='';s.append(all);for(const e of editions){const o=element('option','',e.day);o.value=e.day;s.append(o);}s.value=editions.some(e=>e.day===selected)?selected:'';}
$('#file-input').onchange=async e=>{
 const files=[...e.target.files];try{if(files.some(f=>f.size>MAX_FILE_BYTES))throw Error('单个文件不能超过5MB');if(files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw Error('一次文件总量不能超过20MB');const incoming=[];for(const f of files)incoming.push(...parseImport(JSON.parse(await f.text())));const next=mergeEditions(demo?[]:editions,incoming);editions=next;demo=false;channel='all';$('#search').value='';updateDates();render();message('已在当前页面导入 '+incoming.length+' 期；没有上传文件。');}catch(err){message('导入未完成：'+(err instanceof SyntaxError?'JSON格式有误，请核对示例。':err.message)+' 原页面资料保留。',true);}finally{e.target.value='';}
};
$('#date-filter').onchange=render;$('#search').oninput=render;
$('#demo-button').onclick=()=>{editions=parseImport(demoEdition());demo=true;channel='all';$('#search').value='';updateDates();render();message('正在体验虚构格式示例，所有人物和事件均为虚构。');};
$('#clear-button').onclick=()=>{editions=[];demo=false;channel='all';$('#search').value='';updateDates();render();message('当前页面已清空。');};
$('#download-sample').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(demoEdition(),null,2)],{type:'application/json'}));const a=element('a');a.href=url;a.download='fictional-brief-example.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();

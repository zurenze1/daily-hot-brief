import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DATA=path.resolve(process.env.BRIEF_DATA_DIR||path.join(ROOT,'runtime'));
export const PRESETS={
 apparel:{name:'服装内容',audience:'关注穿着与服装选择的消费者',topics:'服装、款式、面料、工艺、品牌、穿着场景',categories:[{id:'brand',label:'品牌与行业',target:5},{id:'product',label:'服装与工艺',target:5},{id:'consumer',label:'穿着问题',target:5}],queries:['服装 面料 工艺 品牌 最新','穿着 服装 消费 最新'],feeds:[]},
 reading:{name:'读书内容',audience:'希望通过阅读理解生活的读者',topics:'图书、作者、文学、阅读、思想与生活问题',categories:[{id:'books',label:'图书与作者',target:5},{id:'ideas',label:'思想与讨论',target:5},{id:'life',label:'阅读与生活',target:5}],queries:['图书 作者 文学 新书 最新','阅读 书籍 访谈 生活 最新'],feeds:[]},
 luxury:{name:'二奢品牌',audience:'关注二手奢侈品的消费者',topics:'二手奢侈品、包袋、品牌调价、消费选择、回收寄卖',categories:[{id:'brand',label:'品牌动态',target:5},{id:'market',label:'二奢市场',target:5},{id:'consumer',label:'消费话题',target:5}],queries:['奢侈品牌 调价 包袋 最新','二手奢侈品 寄卖 消费 最新'],feeds:[]},
 auto:{name:'汽车内容',audience:'关注选车与用车的消费者',topics:'汽车、新能源、新车、价格变化、行业政策、用车问题',categories:[{id:'launch',label:'新车与技术',target:5},{id:'market',label:'市场与政策',target:5},{id:'consumer',label:'选车用车',target:5}],queries:['汽车 新能源 新车 价格 最新','汽车 产业 政策 消费 最新'],feeds:[]},
 health:{name:'健康产品内容',audience:'关心健康产品证据与消费选择的人',topics:'健康产品、保健食品、公开研究、监管公告、消费者问题',categories:[{id:'evidence',label:'研究证据',target:5},{id:'policy',label:'监管与行业',target:5},{id:'consumer',label:'消费问题',target:5}],queries:['保健食品 监管 公告 最新','营养 健康 研究 系统综述 最新'],feeds:[]},
 custom:{name:'自定义行业',audience:'请填写具体受众',topics:'请填写关注主题',categories:[{id:'industry',label:'行业动态',target:10},{id:'audience',label:'受众问题',target:5}],queries:[],feeds:[]}
};
const str=(v,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';
export function normalizeConfig(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('配置应为对象');
 const industry=str(v.industry,100),audience=str(v.audience,500),positioning=str(v.positioning,1000),topics=str(v.topics,2000);
 if(!industry||!audience||!topics)throw Error('请填写行业、受众和关注主题');
 if(!Array.isArray(v.categories)||!v.categories.length||v.categories.length>12)throw Error('栏目需要1至12个');
 const ids=new Set();const categories=v.categories.map((c,i)=>{const id=str(c.id||'c'+(i+1),40),label=str(c.label,60),target=Number(c.target);if(!/^[a-zA-Z][\w-]{0,39}$/.test(id)||ids.has(id)||!label||!Number.isSafeInteger(target)||target<0||target>100)throw Error('栏目ID、名称或条数无效');ids.add(id);return {id,label,target};});
 const target=categories.reduce((n,c)=>n+c.target,0);if(target<1||target>100)throw Error('每日总量应为1至100条；按可靠来源实际交付，不凑数');
 const feeds=(Array.isArray(v.feeds)?v.feeds:[]).map(x=>str(x,3000)).filter(Boolean);if(feeds.length>30)throw Error('订阅源最多30个');
 for(const f of feeds){const u=new URL(f);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||[...u.searchParams.keys()].some(k=>/^(?:access_token|refresh_token|token|api_key|apikey|password|secret|session|signature|sig)$/i.test(k)))throw Error('订阅源必须是不带凭据的公开HTTP网址');}
 const queries=(Array.isArray(v.queries)?v.queries:[]).map(x=>str(x,300)).filter(Boolean).slice(0,12);
 const provider=v.model?.provider||'codex';if(!['codex','command'].includes(provider))throw Error('模型方式应为codex或command');
 const model={provider,name:str(v.model?.name,100),executable:str(v.model?.executable,2000),args:Array.isArray(v.model?.args)?v.model.args.map(x=>str(x,2000)).slice(0,50):[]};
 if(provider==='command'&&(!model.executable||!path.isAbsolute(model.executable)))throw Error('其他AI需填写经本人确认的绝对可执行路径');
 const discover=v.discover!==false;
 if(!feeds.length&&!discover)throw Error('请设置订阅源，或启用AI联网检索');
 const time=str(v.schedule?.time||'09:00',5),timezone=str(v.schedule?.timezone||'system',100);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('时间请使用24小时制HH:mm');
 if(timezone!=='system')try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw Error('时区无效');}
 const windowHours=Number(v.windowHours||48);if(!Number.isSafeInteger(windowHours)||windowHours<1||windowHours>168)throw Error('新闻时间范围为1至168小时');
 return {version:2,industry,audience,positioning,topics,categories,target,feeds,queries,discover,model,windowHours,schedule:{enabled:v.schedule?.enabled===true,time,timezone},maxPages:Math.min(100,Math.max(10,target*2))};
}
export function dayAndTime(config,at=new Date()){
 const zone=config.schedule.timezone==='system'?Intl.DateTimeFormat().resolvedOptions().timeZone:config.schedule.timezone;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(x=>[x.type,x.value]));
 return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,timezone:zone};
}
export function analysisBatches(config,size=10){const result=[];let categories=[],left=size;for(const c of config.categories){let remain=c.target;while(remain>0){const target=Math.min(remain,left);categories.push({...c,target});remain-=target;left-=target;if(!left){result.push({...config,categories,target:size});categories=[];left=size;}}}if(categories.length)result.push({...config,categories,target:size-left});return result;}

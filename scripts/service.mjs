import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA} from '../server/config.mjs';
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const unit=s=>'"'+s.replace(/%/g,'%%').replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
export function servicePlan(platform=process.platform,{root=ROOT,data=DATA,home=os.homedir(),node=process.execPath,port=process.env.PORT||'4897'}={}){
 if(!/^\d+$/.test(String(port))||Number(port)<1024||Number(port)>65535)throw Error('服务端口应为1024至65535');
 const label='local.daily-hot-brief.'+createHash('sha256').update(root).digest('hex').slice(0,10),entry=path.join(root,'server/main.mjs');
 if(platform==='darwin')return {platform,label,file:path.join(home,'Library/LaunchAgents',label+'.plist'),content:`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(entry)}</string></array><key>WorkingDirectory</key><string>${xml(root)}</string><key>EnvironmentVariables</key><dict><key>BRIEF_DATA_DIR</key><string>${xml(data)}</string><key>PORT</key><string>${port}</string><key>PATH</key><string>${xml(process.env.PATH||'')}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${xml(path.join(data,'service.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(data,'service-error.log'))}</string></dict></plist>`};
 if(platform==='linux')return {platform,label,file:path.join(home,'.config/systemd/user',label+'.service'),content:`[Unit]\nDescription=Daily Hot Brief local service\n[Service]\nExecStart=${unit(node)} ${unit(entry)}\nWorkingDirectory=${unit(root)}\nEnvironment=${unit('BRIEF_DATA_DIR='+data)}\nEnvironment=${unit('PORT='+port)}\nEnvironment=${unit('PATH='+(process.env.PATH||''))}\nRestart=on-failure\n[Install]\nWantedBy=default.target\n`};
 if(platform==='win32'){
  // A tiny environment wrapper avoids placing secrets or unquoted shell commands in a scheduled task.
  const wrapper=path.join(data,'service-entry.mjs');return {platform,label,file:path.join(data,'service-task.xml'),wrapper,wrapperContent:`process.env.BRIEF_DATA_DIR=${JSON.stringify(data)};process.env.PORT=${JSON.stringify(String(port))};await import(${JSON.stringify(new URL('../server/main.mjs',import.meta.url).href)}).then(async m=>{const app=await m.createApp();for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>app.close().then(()=>process.exit(0)));});\n`,content:`<?xml version="1.0" encoding="UTF-16"?><Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers><Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><StartWhenAvailable>true</StartWhenAvailable></Settings><Actions Context="Author"><Exec><Command>${xml(node)}</Command><Arguments>&quot;${xml(wrapper)}&quot;</Arguments><WorkingDirectory>${xml(root)}</WorkingDirectory></Exec></Actions></Task>`};
 }
 throw Error('此系统暂不提供自动启动安装；可保持npm start运行');
}
function run(bin,args,allowFailure=false){const r=spawnSync(bin,args,{encoding:'utf8',windowsHide:true});if(r.status!==0&&!allowFailure)throw Error('系统服务命令未成功：'+bin+'；请由安装AI检查系统回执，不要声称已启用');return r;}
async function main(){const action=process.argv[2]||'status',plan=servicePlan();if(process.argv.includes('--dry-run')){console.log(JSON.stringify(plan,null,2));return;}await fs.mkdir(DATA,{recursive:true,mode:0o700});const uid=process.getuid?.();
 if(action==='install'){
  let old;try{old=await fs.readFile(plan.file,plan.platform==='win32'?'utf16le':'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(old&&!old.includes(ROOT)&&!old.includes(xml(ROOT)))throw Error('已有同名服务归属不符，未覆盖');
  if(plan.platform==='darwin'&&old)run('launchctl',['bootout','gui/'+uid,plan.file],true);
  await fs.mkdir(path.dirname(plan.file),{recursive:true,mode:0o700});if(plan.wrapper)await fs.writeFile(plan.wrapper,plan.wrapperContent,{mode:0o600});await fs.writeFile(plan.file,plan.content,{mode:0o600,encoding:plan.platform==='win32'?'utf16le':'utf8'});
  if(plan.platform==='darwin')run('launchctl',['bootstrap','gui/'+uid,plan.file]);else if(plan.platform==='linux'){run('systemctl',['--user','daemon-reload']);run('systemctl',['--user','enable','--now',plan.label]);}else{run('schtasks.exe',['/Create','/TN',plan.label,'/XML',plan.file,'/F']);run('schtasks.exe',['/Run','/TN',plan.label]);}
  console.log('已提交开机／登录启动：'+plan.label+'。请继续核验HTTP健康、实际模型和首次日更；数据仍在本机。');
 }else if(action==='uninstall'){
  let old;try{old=await fs.readFile(plan.file,plan.platform==='win32'?'utf16le':'utf8');}catch(e){if(e.code==='ENOENT'){console.log('没有本目录安装的服务');return;}throw e;}if(!old.includes(ROOT)&&!old.includes(xml(ROOT)))throw Error('服务归属不符，未卸载');
  if(plan.platform==='darwin')run('launchctl',['bootout','gui/'+uid,plan.file],true);else if(plan.platform==='linux'){run('systemctl',['--user','disable','--now',plan.label],true);}else{run('schtasks.exe',['/End','/TN',plan.label],true);run('schtasks.exe',['/Delete','/TN',plan.label,'/F']);}await fs.unlink(plan.file);console.log('已移除本工具自动启动，配置和历史数据保留');
 }else if(action==='status'){
  const r=plan.platform==='darwin'?run('launchctl',['print','gui/'+uid+'/'+plan.label],true):plan.platform==='linux'?run('systemctl',['--user','is-active',plan.label],true):run('schtasks.exe',['/Query','/TN',plan.label],true);console.log(JSON.stringify({label:plan.label,systemCommandSucceeded:r.status===0,file:plan.file}));
 }else throw Error('使用npm run service -- install、status或uninstall；--dry-run只预览');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});

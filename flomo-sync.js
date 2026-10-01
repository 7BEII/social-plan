/* flomo browser sync. Credentials stay in this browser and never enter the repository. */
(function () {
  'use strict';
  const ROOT = '#PD/谈恋爱';
  const TOKEN_KEY = 'social-plan.flomo.token.v1';
  const REMOVED_KEY = 'social-plan.flomo.hidden.v1';
  const READ_URL = 'https://flomoapp.com/api/v1/memo/updated/';
  const WRITE_URL = 'https://flomoapp.com/api/v2';
  const PROXY = (window.SOCIAL_FLOMO_PROXY || '').replace(/\/$/,'');
  let busy = false;
  let hidden = new Set(JSON.parse(localStorage.getItem(REMOVED_KEY) || '[]'));
  function token() { return (localStorage.getItem(TOKEN_KEY) || '').trim(); }
  function requireToken() {
    if (!token()) { openFlomoSettings(); throw new Error('请先导入 flomo 登录配置'); }
    return token().startsWith('Bearer ') ? token() : 'Bearer ' + token();
  }
  function signed(params) {
    const p = { ...params };
    const entries = Object.keys(p).sort().flatMap(k => {
      const v = p[k];
      if (v === '' || v === null || v === undefined) return [];
      return Array.isArray(v) ? [...v].sort().map(x => k + '[]=' + x) : [k + '=' + v];
    });
    p.sign = md5(entries.join('&') + 'dbbc3dd73364b4084c3a69346e0ce2b2');
    return p;
  }
  async function request(method, path, data) {
    const read = method === 'GET';
    const params = signed({ ...data, timestamp: String(Math.floor(Date.now()/1000)), api_key:'flomo_web', app_version:read?'5.25.64':'4.0', platform:read?'mac':'web', webp:'1' });
    const url = read ? (PROXY ? PROXY + '/read?' : READ_URL + '?') + new URLSearchParams(params) : (PROXY || WRITE_URL) + path;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch(url, { method, headers:{Authorization:requireToken(), ...(read ? {} : {'Content-Type':'application/json'})}, body:read?undefined:JSON.stringify(params), signal:controller.signal });
      if (r.status === 401 || r.status === 403) throw new Error('flomo 登录已失效，请重新导入 Token');
      if (!r.ok) throw new Error('flomo 请求失败 HTTP ' + r.status);
      const payload = await r.json();
      if (payload.code !== 0) throw new Error('flomo 请求未成功，请检查登录状态');
      return payload.data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('flomo 请求超时，本机修改已保留');
      if (e instanceof TypeError) throw new Error('无法连接 flomo，请检查网络；本机数据已保留');
      throw e;
    } finally { clearTimeout(timeout); }
  }
  function plain(html) {
    const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,'\n'), 'text/html');
    return (doc.body.textContent || '').trim();
  }
  function inScope(text) { return /(^|\s)#PD\/谈恋爱(?=$|[\s/])/u.test(text); }
  function field(text, label) {
    const safe = label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return text.match(new RegExp('(?:^|\\n)' + safe + '\\s*[:：]\\s*([^\\n]*)'))?.[1]?.trim() || '';
  }
  function numericId(slug) { let h=2166136261; for(const c of slug) h=Math.imul(h^c.charCodeAt(0),16777619); return 1000000000000+(h>>>0); }
  function parseMemo(memo) {
    const text = plain(memo.content); if (!inScope(text) || memo.deleted_at) return null;
    const type = field(text,'记录类型');
    const rawId = field(text,'记录ID');
    const id = /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) ? Number(rawId) : numericId(memo.slug);
    const meta = { sourceSlug:memo.slug, cloudContent:memo.content, cloudUpdatedAt:memo.updated_at, hasAttachments:!!(memo.files?.length || memo.images?.length), dirty:false };
    if (type === '意向人') {
      const rawScore=field(text,'意向值'); const score=Number(rawScore);
      return {kind:'target', item:{ id,name:field(text,'姓名')||'未命名',tier:['S','A','B','C'].includes(field(text,'层级'))?field(text,'层级'):'A',circle:field(text,'圈子')||'未分类',notes:text.match(/(?:^|\n)备注\s*[:：][ \t]*([\s\S]*)$/)?.[1]||'',energyScore:rawScore!==''&&Number.isInteger(score)&&score>=0&&score<=100?score:null,keywords:[...new Set(field(text,'偏好关键词').split(/[,，、]/).map(x=>x.trim()).filter(Boolean))],...meta}};
    }
    if (type === '评估') {
      const rawScore=field(text,'意向值'); const score=Number(rawScore),targetId=Number(field(text,'意向人ID'));
      if(rawScore===''||!Number.isInteger(score)||score<0||score>100||!Number.isSafeInteger(targetId))return null;
      return {kind:'assessment',item:{id,targetId,date:field(text,'评估时间'),score,...meta}};
    }
    const body = type === '经验笔记' ? (text.match(/(?:^|\n)经验教训\s*[:：][ \t]*\n?([\s\S]*)$/)?.[1]||'') : text.replace(/(^|\s)#PD\/谈恋爱(?=$|[\s/])/gu,'$1').trim();
    const tag=field(text,'字段标签') || [...text.matchAll(/(?:^|\s)#([^\s#]+)/gu)].map(x=>x[1]).filter(x=>!x.startsWith('PD/谈恋爱')).join(' · ') || '谈恋爱';
    return {kind:'note',item:{id,tag,text:body,...meta}};
  }
  async function fetchMemos() {
    if(PROXY) { const list=await request('GET','',{limit:200,tz:'8:0'}); if(!Array.isArray(list))throw new Error('代理返回格式异常'); return list.filter(m=>inScope(plain(m.content))); }
    const collected = new Map(); let cursor = {};
    for(let page=0;page<100;page++) {
      if(page) await new Promise(resolve=>setTimeout(resolve,800));
      const list=await request('GET','',{limit:200,tz:'8:0',...cursor});
      if(!Array.isArray(list)) throw new Error('flomo 返回格式异常，未导入任何数据');
      for(const m of list) if(m.slug) collected.set(m.slug,m);
      if(list.length<200) return [...collected.values()].filter(m=>inScope(plain(m.content)));
      const last=list[list.length-1];
      const normalized=last.updated_at.replace(' ','T');
      const stamp=Math.floor(new Date(normalized + (/(Z|[+-]\d{2}:?\d{2})$/.test(normalized)?'':'+08:00')).getTime()/1000);
      const next={latest_slug:last.slug,latest_updated_at:stamp};
      if(!last.slug||!Number.isFinite(stamp)||JSON.stringify(next)===JSON.stringify(cursor)) throw new Error('flomo 分页未完成，保留本机数据');
      cursor=next;
    }
    throw new Error('flomo 笔记过多，拉取尚未完整，未覆盖本机数据');
  }
  function records(kind) { return kind==='target'?STATE.targets:kind==='note'?personalNotes:assessmentRecords; }
  function allRecords() { return ['target','note','assessment'].flatMap(kind=>records(kind).map(item=>({kind,item}))); }
  function serialize(kind,item) {
    const head=ROOT+'\n记录ID: '+item.id+'\n';
    if(kind==='target') return head+'记录类型: 意向人\n姓名: '+item.name+'\n层级: '+item.tier+'\n圈子: '+(item.circle||'')+'\n意向值: '+(item.energyScore??'')+'\n偏好关键词: '+(item.keywords||[]).join('，')+'\n备注: '+(item.notes||'');
    if(kind==='assessment') return head+'记录类型: 评估\n意向人ID: '+item.targetId+'\n意向值: '+item.score+'\n评估时间: '+item.date;
    return head+'记录类型: 经验笔记\n字段标签: '+item.tag+'\n经验教训:\n'+item.text;
  }
  function saveAll() { persistPersonalData(); localStorage.setItem(REMOVED_KEY,JSON.stringify([...hidden])); refreshSyncStatus(); }
  function refreshViews() {renderPipeline();renderPersonalNotes();renderAssessmentOverview();renderPreferences();}
  function refreshSyncStatus(message) {
    const pending=allRecords().filter(r=>r.item.dirty&&!r.item.isDemo).length;
    document.getElementById('sync-status-text').textContent=message || (token()?(PROXY?'flomo 代理模式':'flomo 直连模式'):'flomo 未配置')+' · 待同步 '+pending+' 条';
    const service=document.getElementById('flomo-service-status');if(service)service.textContent=PROXY?'同步服务已配置':'同步服务待接通；当前直连测试可能被浏览器拦截';
    const status=document.getElementById('flomo-token-status'); if(status)status.textContent=token()?'Token 已保存在此浏览器':'尚未保存 Token';
  }
  window.openFlomoSettings=function() { document.getElementById('flomo-settings').classList.remove('hidden');refreshSyncStatus(); };
  window.closeFlomoSettings=function() {document.getElementById('flomo-settings').classList.add('hidden');};
  window.saveFlomoToken=function(value) {
    const clean=(value===undefined?document.getElementById('flomo-token-input').value:value).trim().replace(/^Bearer\s+/i,'');
    if(!clean||/\s/.test(clean))return showToast('请输入有效的 flomo Token');
    try {localStorage.setItem(TOKEN_KEY,clean);} catch(_) {return showToast('当前浏览器无法保存登录配置');}
    document.getElementById('flomo-token-input').value='';refreshSyncStatus();showToast('登录配置已保存，可以点击拉取');
  };
  window.importFlomoToken=async function(input) {
    try { const config=JSON.parse(await input.files[0].text());if(typeof config.token!=='string')throw new Error();saveFlomoToken(config.token); }
    catch(_) {showToast('请选择包含 token 字段的本地配置JSON');} finally {input.value='';}
  };
  window.clearFlomoToken=function() {localStorage.removeItem(TOKEN_KEY);document.getElementById('flomo-token-input').value='';refreshSyncStatus();showToast('本机登录配置已清除');};
  window.handlePullData=async function() {
    if(busy)return;busy=true;refreshSyncStatus('正在拉取 #PD/谈恋爱…');
    try {
      const memos=await fetchMemos(); let imported=0,kept=0;
      STATE.targets=STATE.targets.filter(t=>!t.isDemo);
      for(const memo of memos) {
        const parsed=parseMemo(memo); if(!parsed||hidden.has(memo.slug))continue;
        const list=records(parsed.kind); const existing=list.find(x=>x.sourceSlug===memo.slug||x.id===parsed.item.id);
        if(existing?.dirty) {kept++;continue;}
        if(existing) Object.assign(existing,parsed.item); else list.unshift(parsed.item);
        imported++;
      }
      saveAll();refreshViews();refreshSyncStatus('已拉取 '+imported+' 条 · 保留待同步 '+kept+' 条');
      document.getElementById('sync-time-badge').textContent=new Date().toLocaleTimeString('zh-CN');
      showToast('拉取完成：'+imported+' 条真实记录');
    } catch(e) {refreshSyncStatus('拉取失败 · 本机数据保留');showToast(e.message);}
    finally {busy=false;}
  };
  window.handlePushData=async function() {
    if(busy)return;busy=true;refreshSyncStatus('正在同步到 flomo…');
    try {
      let pending=allRecords().filter(r=>r.item.dirty&&!r.item.isDemo);
      if(!pending.length){requireToken();refreshSyncStatus('没有待同步修改');return;}
      const cloud=await fetchMemos();let ok=0;
      for(const {kind,item} of pending) {
        const remote=cloud.find(m=>item.sourceSlug?m.slug===item.sourceSlug:(parseMemo(m)?.kind===kind && field(plain(m.content),'记录ID')===String(item.id)));
        if(item.hasAttachments)throw new Error('原笔记含附件，请在 flomo 编辑；本机文字修改保留');
        if(item.sourceSlug && (!remote||remote.content!==item.cloudContent))throw new Error('有笔记已在 flomo 修改，请先处理两端差异；本机修改保留');
        if(item.uncertain&&!remote)throw new Error('上次写入结果未确认，请先在 flomo 检查这条记录，避免重复创建');
        const before=serialize(kind,item);
        const content='<p>'+escapeHtml(before).replace(/\n/g,'</p><p>')+'</p>';
        const data={content,...(remote&&PROXY?{expected_content:item.cloudContent}:{}),...(remote?{}:{created_at:Math.floor(Date.now()/1000)}),source:'web',memo_from:'human',...(remote?{}:{file_ids:[]}),tz:'8:0',pin:0,...(remote?{local_updated_at:Math.floor(Date.now()/1000)}:{})};
        let result;
        try {result=await request(remote?'PUT':'POST',remote?'/memo/'+encodeURIComponent(remote.slug):'/memo',data);}
        catch(e) {if(!remote)item.uncertain=true;saveAll();throw e;}
        if(!result?.slug || (remote&&result.slug!==remote.slug)) {item.uncertain=!remote;saveAll();throw new Error('flomo 未确认记录ID，修改继续保留待同步');}
        Object.assign(item,{sourceSlug:result.slug,cloudContent:result.content||content,cloudUpdatedAt:result.updated_at,dirty:serialize(kind,item)!==before,uncertain:false});
        ok++;saveAll();
      }
      refreshSyncStatus('已同步 '+ok+' 条到 flomo');showToast('真实同步完成：'+ok+' 条');
    } catch(e) {refreshSyncStatus('同步未全部完成 · 修改保留');showToast(e.message);}
    finally {busy=false;}
  };
  const oldSaveNote=savePersonalNote;
  savePersonalNote=function() {
    const oldId=editingNoteId,ids=new Set(personalNotes.map(x=>x.id));oldSaveNote();
    if(!document.getElementById('note-editor').classList.contains('hidden'))return;
    const item=oldId===null?personalNotes.find(x=>!ids.has(x.id)):personalNotes.find(x=>x.id===oldId);
    if(item)item.dirty=true;saveAll();
  };
  const oldAdd=submitNewTarget;
  submitNewTarget=function() {const ids=new Set(STATE.targets.map(x=>x.id));oldAdd();const item=STATE.targets.find(x=>!ids.has(x.id));if(item)item.dirty=true;saveAll();};
  const oldScore=saveAssessment;
  saveAssessment=function() {const previous=assessmentRecords.length;oldScore();if(assessmentRecords.length!==previous){const a=assessmentRecords[0];a.id=Date.now();a.dirty=true;const t=STATE.targets.find(x=>x.id===a.targetId);if(t){t.dirty=true;t.isDemo=false;}saveAll();}};
  const oldKeywords=saveKeywords;
  saveKeywords=function(id,value) {oldKeywords(id,value);const t=STATE.targets.find(x=>x.id===id);if(t){t.dirty=true;t.isDemo=false;}saveAll();};
  const oldDeleteTarget=deleteTarget;
  deleteTarget=function(id) {const t=STATE.targets.find(x=>x.id===id);oldDeleteTarget(id);if(t?.sourceSlug&&!STATE.targets.some(x=>x.id===id))hidden.add(t.sourceSlug);saveAll();};
  const oldDelete=deletePersonalNote;
  deletePersonalNote=function() {const n=personalNotes.find(x=>x.id===editingNoteId);if(n?.sourceSlug)hidden.add(n.sourceSlug);oldDelete();saveAll();showToast('已从本机移除，flomo 原笔记保留');};
  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('[title="读取模拟备份（未接通flomo）"]')?.setAttribute('title','拉取 #PD/谈恋爱');
    document.querySelector('[title="保存模拟备份（未接通flomo）"]')?.setAttribute('title','推送本机修改到 flomo');
    refreshSyncStatus();
  });
  window.SocialFlomo={plain,inScope,parseMemo,serialize,signed};
}());








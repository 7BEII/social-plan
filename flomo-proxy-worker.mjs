// Token is provided per request and never stored. Only #PD/谈恋爱 memos are exposed.
const ROOT='#PD/谈恋爱';
function sign(params){const p={...params};delete p.sign;const text=Object.keys(p).sort().flatMap(k=>p[k]===''||p[k]==null?[]:Array.isArray(p[k])?[...p[k]].sort().map(x=>k+'[]='+x):[k+'='+p[k]]).join('&');p.sign=md5(text+'dbbc3dd73364b4084c3a69346e0ce2b2');return p;}
function scoped(content){return /(^|\s)#PD\/谈恋爱(?=$|[\s/])/u.test(content.replace(/<[^>]*>/g,' '));}
async function call(token,method,path,fields){const read=method==='GET';const data=sign({...fields,timestamp:String(Math.floor(Date.now()/1000)),api_key:'flomo_web',app_version:read?'5.25.64':'4.0',platform:read?'mac':'web',webp:'1'});const url=read?'https://flomoapp.com/api/v1/memo/updated/?'+new URLSearchParams(data):'https://flomoapp.com/api/v2'+path;const response=await fetch(url,{method,headers:{Authorization:token,...(read?{}:{'Content-Type':'application/json'})},body:read?undefined:JSON.stringify(data)});if(!response.ok)throw new Error('flomo HTTP '+response.status);const payload=await response.json();if(payload.code!==0)throw new Error('flomo登录或请求失败');return payload.data;}
async function readAll(token){const memos=new Map();let cursor={};for(let page=0;page<40;page++){const list=await call(token,'GET','',{limit:200,tz:'8:0',...cursor});if(!Array.isArray(list))throw new Error('flomo响应异常');for(const m of list)if(m.slug)memos.set(m.slug,m);if(list.length<200)return [...memos.values()].filter(m=>scoped(m.content)&&!m.deleted_at);const last=list.at(-1);const raw=last.updated_at.replace(' ','T');const timestamp=Math.floor(new Date(raw+(/(Z|[+-]\d{2}:?\d{2})$/.test(raw)?'':'+08:00')).getTime()/1000);const next={latest_slug:last.slug,latest_updated_at:timestamp};if(!Number.isFinite(timestamp)||JSON.stringify(next)===JSON.stringify(cursor))throw new Error('分页未完整');cursor=next;}throw new Error('笔记超出单次处理范围');}
export default {async fetch(request,env){const origin=request.headers.get('Origin');const allowed=env.ALLOWED_ORIGIN||'https://7beii.github.io';const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Cache-Control':'no-store'};const reply=(body,status=200)=>Response.json(body,{status,headers:cors});const url=new URL(request.url);if(url.pathname==='/health')return reply({service:'social-plan-flomo',ok:true});if(origin!==allowed)return reply({code:1,message:'Origin not allowed'},403);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const token=request.headers.get('Authorization')||'';if(!/^Bearer \S+$/.test(token))return reply({code:1,message:'需要有效Token'},401);try {if(request.method==='GET'&&url.pathname==='/read'){const data=await readAll(token);return reply({code:0,data});}if((request.method==='POST'&&url.pathname==='/memo')||(request.method==='PUT'&&/^\/memo\/[a-zA-Z0-9_-]+$/.test(url.pathname))){if(Number(request.headers.get('Content-Length'))>200000)return reply({code:1,message:'内容过长'},413);const data=await request.json();if(typeof data.content!=='string'||data.content.length>100000||!scoped(data.content))return reply({code:1,message:'只允许指定标签内容'},400);if(request.method==='PUT'){const slug=url.pathname.split('/').pop();const memos=await readAll(token);const existing=memos.find(m=>m.slug===slug);if(!existing)return reply({code:1,message:'记录不在同步范围'},403);if(typeof data.expected_content!=='string'||existing.content!==data.expected_content)return reply({code:1,message:'记录已更新，请先处理两端差异'},409);}delete data.expected_content;const result=await call(token,request.method,url.pathname,data);return reply({code:0,data:result});}return reply({code:1,message:'Route not allowed'},404);}catch(e){return reply({code:1,message:String(e.message)},502);}}};

/* MD5 signature helper reused from PD-rich. No personal credentials. */
function md5(input) {
  function cmn(q, a, b, x, s, t) {
    a = (a + q + x + t) | 0;
    return (((a << s) | (a >>> (32 - s))) + b) | 0;
  }
  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = (x[0] + a) | 0;
    x[1] = (x[1] + b) | 0;
    x[2] = (x[2] + c) | 0;
    x[3] = (x[3] + d) | 0;
  }
  function md5blk(s) {
    const blocks = [];
    for (let i = 0; i < 64; i += 4) {
      blocks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return blocks;
  }
  function md51(s) {
    const txt = unescape(encodeURIComponent(s));
    let n = txt.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(txt.substring(i - 64, i)));
    const tail = Array(16).fill(0);
    const remain = txt.substring(i - 64);
    for (i = 0; i < remain.length; i++) tail[i >> 2] |= remain.charCodeAt(i) << (i % 4 << 3);
    tail[i >> 2] |= 0x80 << (i % 4 << 3);
    if (i > 55) {
      md5cycle(state, tail);
      tail.fill(0);
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function rhex(n) {
    const hex = "0123456789abcdef";
    let s = "";
    for (let j = 0; j < 4; j++) s += hex[(n >> (j * 8 + 4)) & 0x0f] + hex[(n >> (j * 8)) & 0x0f];
    return s;
  }
  return md51(input).map(rhex).join("");
}


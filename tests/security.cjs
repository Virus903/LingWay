const {request}=require('./playwright-runtime.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const ctx=await request.newContext({baseURL:'http://localhost:5181'});
 let state=await(await ctx.get('/api/bootstrap')).json();
 const accounts=fs.readFileSync(path.resolve(__dirname,process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt"),'utf8');
 const password=accounts.match(/Email: student@lingway\.local\s+Пароль: ([^\r\n]+)/)[1];
 assert.equal((await ctx.post('/api/login',{data:{email:'student@lingway.local',password},headers:{'X-CSRF-Token':state.csrf}})).status(),200);
 state=await(await ctx.get('/api/bootstrap')).json();
 for(const route of ['/api/profile','/api/delete-account','/api/password','/api/lesson-progress'])
  assert.equal((await ctx.post(route,{data:{}})).status(),403,'CSRF '+route);
 const post=(route,data)=>ctx.post('/api/'+route,{data,headers:{'X-CSRF-Token':state.csrf}});
 assert.equal((await post('lesson-progress',{owner_id:state.user.id+999,state:{}})).status(),403);
 const locked=state.lessons.find(l=>state.modules.find(m=>m.id===l.module_id)?.position>1&&!state.modules.find(m=>m.id===l.module_id)?.emergency);
 // An unknown lesson must never expose assessment data.
 assert.equal((await post('assess',{lesson_id:2147483647,version:1,index:0,value:'x'})).status(),403);
 for(const route of ['/App_Data/vapid.json','/App_Data/mailbox.txt','/appsettings.json','/../App_Data/vapid.json']){
  const r=await ctx.get(route);assert.ok(r.status()===404 || (r.headers()['content-type']||'').includes('text/html'),'private file disclosure '+route);
 }
 const r=await ctx.get('/api/bootstrap');
 assert.equal(r.headers()['x-content-type-options'],'nosniff');
 assert.equal(r.headers()['x-frame-options'],'DENY');
 assert.ok(r.headers()['cache-control'].includes('no-store'));
 const serialized=JSON.stringify(await r.json());
 assert.ok(!/PasswordHash|SecurityStamp|SaltHex|HashHex|Mail:Password/.test(serialized));
 await ctx.dispose();
 console.log('PASS: sensitive-route CSRF, cross-account checkpoint protection, hidden assessment, private-file isolation, security headers, no credential fields in bootstrap.');
})().catch(e=>{console.error(e);process.exitCode=1;});

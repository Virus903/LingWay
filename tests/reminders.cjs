const {request}=require('./playwright-runtime.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const ctx=await request.newContext({baseURL:'http://localhost:5181'});
 let state=await(await ctx.get('/api/bootstrap')).json();
 async function post(route,data){const r=await ctx.post('/api/'+route,{data,headers:{'X-CSRF-Token':state.csrf}});assert.equal(r.status(),200,await r.text());}
 await post('guest',{});state=await(await ctx.get('/api/bootstrap')).json();
 await post('favorite',{id:state.phrases[0].id,enabled:true});
 const inbox=async()=> (await(await ctx.get('/api/notifications')).json()).filter(n=>n.title==='Пора повторить фразы');
 await post('profile',{profile:{notifications:false,reminder_time:'00:00',quiet_start:'00:00',quiet_end:'00:00'}});
 assert.equal((await inbox()).length,0,'disabled reminders must not create messages');
 const time=offset=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(Date.now()+offset));
 await post('profile',{profile:{notifications:true,quiet_start:time(-3600000),quiet_end:time(3600000)}});
 assert.equal((await inbox()).length,0,'quiet hours must suppress reminders');
 await post('profile',{profile:{quiet_start:'00:00',quiet_end:'00:00'}});
 assert.equal((await inbox()).length,1,'due reminder delivered to inbox');
 assert.equal((await inbox()).length,1,'repeated poll does not duplicate reminder');
 await ctx.dispose();
 console.log('PASS: in-site reminder scheduling, disabled setting, quiet hours, and daily deduplication.');
})().catch(e=>{console.error(e);process.exitCode=1;});

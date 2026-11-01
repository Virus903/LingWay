const {request,chromium}=require('./playwright-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const baseURL='http://localhost:5181';
const accounts=fs.readFileSync(path.resolve(__dirname,process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt"),'utf8');
const password=accounts.match(/Email: student@lingway\.local\s+Пароль: ([^\r\n]+)/)[1];
let checks=0;
(async()=>{
 const ctx=await request.newContext({baseURL});let state=await(await ctx.get('/api/bootstrap')).json();
 async function post(route,body,status=200){const r=await ctx.post('/api/'+route,{data:body,headers:{'X-CSRF-Token':state.csrf}});assert.equal(r.status(),status,route+': '+await r.text());checks++;return r.json();}
 await post('login',{email:'student@lingway.local',password});state=await(await ctx.get('/api/bootstrap')).json();
 assert.ok(state.members.every(m=>m.user_id===state.user.id));checks++;
 await post('profile',{profile:{avatar:'data:image/png;base64,PHNjcmlwdD4='}},400);
 const l=state.lessons[0], answers=[];let index=0;
 while(index<l.steps.length){const s=l.steps[index],value=s.options?String(s.answer):s.accepted[0];answers.push({step_index:index,value});index=s.routes?.find(r=>r.answer.toLowerCase()===value.toLowerCase())?.target??s.next??index+1;}
 const attempt={id:crypto.randomUUID(),lesson_id:l.id,version:l.version,answers,duration:600};
 const batch={owner_id:state.user.id,attempts:[attempt]};
 const a=await post('attempts/batch',batch);assert.equal(a.results[0].status,200);
 const b=await post('attempts/batch',batch);assert.equal(b.results[0].result.id,a.results[0].result.id);
 const conflict=await post('attempts/batch',{...batch,attempts:[{...attempt,duration:601}]});assert.equal(conflict.results[0].status,409);
 await post('attempts/batch',{...batch,owner_id:999999},403);
 await post('attempt',{...attempt,duration:601},409);
 const manifest=await(await ctx.get('/api/offline-manifest')).json();
 assert.equal(manifest.schema,1);assert.ok(Object.keys(manifest.audio).length>=375);
 assert.equal(manifest.bytes,manifest.assets.reduce((n,a)=>n+a.bytes,0));checks++;
 const wav=manifest.assets.find(a=>a.type==='audio/wav');const wavRes=await ctx.get(wav.url);const bytes=await wavRes.body();
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),wav.sha256);checks++;
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const browserCtx=await browser.newContext({baseURL,storageState:await ctx.storageState()});const page=await browserCtx.newPage();
  page.on('dialog',d=>d.accept());await page.goto('/#dashboard');await page.waitForFunction(()=>typeof data!=='undefined'&&data.user&&typeof downloadOffline==='function');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>data.user&&navigator.serviceWorker.controller);
  await page.evaluate(()=>downloadOffline());
  const snapshot=await page.evaluate(()=>offlineGet('snapshot-'+data.user.id));assert.equal(snapshot.package_id,manifest.id,await page.locator('body').innerText());assert.ok(snapshot.offline_audio);assert.deepEqual(snapshot.users,[]);assert.deepEqual(snapshot.groups,[]);checks++;
  await browserCtx.setOffline(true);await page.reload();await page.waitForFunction(()=>data.user&&data.offline_audio);
  const offlineAudio=await page.evaluate(async()=>{const url=Object.values(data.offline_audio)[0];const response=await fetch(url,{headers:{Range:'bytes=0-99'}});return {status:response.status,length:(await response.arrayBuffer()).byteLength};});
  assert.equal(offlineAudio.status,206);assert.equal(offlineAudio.length,100);checks++;
  await browserCtx.setOffline(false);
  // Corrupt one staged asset and force network failure: active snapshot remains unchanged.
  const revision=await page.evaluate(()=>data.package_revision);
  await page.evaluate(async url=>{const cache=await caches.open('lingway-content-v1');await cache.put(url,new Response('broken'));},wav.url);
  await page.route('**'+wav.url,route=>route.abort());await page.evaluate(()=>downloadOffline());
  assert.equal(await page.evaluate(async()=> (await offlineGet('snapshot-'+data.user.id)).package_revision),revision);checks++;
  await page.unroute('**'+wav.url);await page.evaluate(()=>downloadOffline());
  const pending={...attempt,id:crypto.randomUUID()};
  await page.evaluate(async a=>{await offlineSet('queue-'+data.user.id,[a]);},pending);
  await page.evaluate(()=>syncQueue());assert.equal(await page.evaluate(async()=> (await offlineGet('queue-'+data.user.id)).length),0);checks++;
  await browserCtx.close();
 }finally{await browser.close();await ctx.dispose();}
 console.log(`PASS: ${checks} hardening checks; batch/idempotency/ownership, media signatures, asset hashes, offline audio range, interrupted update and queue sync.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

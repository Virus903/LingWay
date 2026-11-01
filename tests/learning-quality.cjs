const {request,chromium}=require('./playwright-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const policy=require('../src/LingWay.Web/wwwroot/assessment-policy.js');
const baseURL='http://localhost:5181', database='LingWay_HardeningTest20261101';
const credentials=fs.readFileSync(path.resolve(__dirname,process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt"),'utf8');
const contexts=[];let checks=0;
function sql(query){return cp.execFileSync('sqlcmd',['-S','localhost','-E','-C','-d',database,'-b','-h','-1','-W','-Q',query],{encoding:'utf8'}).trim();}
async function client(role){
 const ctx=await request.newContext({baseURL});contexts.push(ctx);let state;
 const c={ctx,async refresh(){state=await(await ctx.get('/api/bootstrap')).json();return state},get state(){return state},async post(route,body,status=200){
  const r=await ctx.post('/api/'+route,{data:body,headers:{'X-CSRF-Token':state.csrf}});
  assert.equal(r.status(),status,route+': '+(r.ok()?'ok':await r.text()));checks++;return r.json();
 }};
 await c.refresh();if(role){const email=role+'@lingway.local',password=credentials.match(new RegExp('Email: '+email.replaceAll('.','\\.')+'\\s+Пароль: ([^\\r\\n]+)'))[1];await c.post('login',{email,password});await c.refresh();}return c;
}
(async()=>{let browser;try{
 const admin=await client('admin'),teacher=await client('teacher'),student=await client('student');
 const quality=await(await admin.ctx.get('/api/learning-quality')).json();
 assert.equal(quality.lessons.length,21);assert.ok(quality.lessons.every(l=>l.validation==='OK'),JSON.stringify(quality.lessons.filter(l=>l.validation!=='OK')));checks++;
 const own=await teacher.post('groups',{name:'Quality '+Date.now()});
 const foreign=await admin.post('groups',{name:'Foreign quality '+Date.now()});
 await teacher.post('members',{group_id:own.id,email:student.state.user.email});
 const module=student.state.modules[0].id;
 await teacher.post('assignments',{group_id:own.id,module_id:module,student_id:student.state.user.id,due:'2026-01-01'});
 await teacher.post('assignments',{group_id:foreign.id,module_id:module,student_id:student.state.user.id},403);
 await teacher.post('assignments',{group_id:own.id,module_id:module,student_id:9999999},403);
 await student.refresh();assert.ok(student.state.assignments.some(a=>a.group_id===own.id&&a.student_id===student.state.user.id));checks++;
 assert.equal((await teacher.ctx.get('/api/report?group='+foreign.id)).status(),403);checks++;
 const lesson=student.state.lessons[0],index=lesson.steps.findIndex(s=>s.type==='text');
 for(const value of [lesson.steps[index].accepted[0], '', 'no '+lesson.steps[index].accepted[0], 'xxxxxxxx',lesson.steps[index].accepted[0].slice(0,-1)]){
  const remote=await student.post('assess',{lesson_id:lesson.id,version:lesson.version,index,value});
  assert.deepEqual(remote,policy.check(lesson.steps[index],value,lesson.meta.criteria.near_threshold));checks++;
 }
 const data_uri='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4FEAAAAASUVORK5CYII=';
 const media=await admin.post('media',{name:'Quality test image.png',data_uri});
 const duplicate=await admin.post('media',{name:'Duplicate.png',data_uri});assert.equal(media.id,duplicate.id);checks++;
 assert.equal((await(await admin.ctx.get('/api/media/'+media.id)).json()).data_uri,data_uri);checks++;
 await student.post('media',{name:'bad.png',data_uri},403);
 assert.equal((await teacher.ctx.get('/api/media')).status(),403);checks++;
 const phrase='Quality phrase '+Date.now();
 const rows=[{en:phrase,ru:'Проверка',category:'Тест'},{en:phrase,ru:'Дубль',category:'Тест'},{en:'',ru:'Нет слова',category:'Тест'}];
 const preview=await admin.post('import-check',{kind:'phrases',rows});assert.equal(preview.valid,1);assert.equal(preview.errors.length,2);checks++;
 const imported=await admin.post('import-commit',{kind:'phrases',rows});assert.equal(imported.added,1);checks++;
 const replay=await admin.post('import-commit',{kind:'phrases',rows});assert.equal(replay.added,0);checks++;
 const suffix=Date.now();const first='quality-first-'+suffix+'@example.test',second='quality-fail-'+suffix+'@example.test';
 sql("CREATE OR ALTER TRIGGER dbo.TR_QualityFailTemporary ON dbo.GroupMembers AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.AspNetUsers u ON u.Id=i.UserId WHERE u.Email LIKE 'quality-fail-%') THROW 51000, 'Intentional isolated import test failure', 1; END");
 try{
  await teacher.post('import-commit',{kind:'students',group_id:own.id,rows:[first,second].map(email=>({email,first_name:'Test',last_name:'Rollback',password:'Quality-Only-2026'}))},400);
  assert.equal(sql("SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.AspNetUsers WHERE Email IN ('"+first+"','"+second+"')"),'0');checks++;
 }finally{sql('DROP TRIGGER IF EXISTS dbo.TR_QualityFailTemporary');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({baseURL,storageState:await admin.ctx.storageState()});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#modules');await page.waitForFunction(()=>typeof data!=='undefined'&&data.user&&typeof loadQualityReport==='function');
 await page.getByRole('button',{name:'Проверить уроки'}).click();await page.waitForFunction(()=>document.querySelector('#quality-results')?.textContent.includes('Регистрация'));
 await page.evaluate(()=>{ui.editor=structuredClone(data.lessons[0]);chooseLibraryMedia(0,'image')});
 await page.locator('#media-library-dialog').waitFor();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.goto('/#reports');await page.waitForFunction(()=>typeof reportRecords==='function'&&data.user);
 const records=await page.evaluate(()=>{learningState.report={};return reportRecords().length});
 const csv=await(await admin.ctx.get('/api/report?format=csv')).text();
 // Newlines inside quoted CSV cells are allowed; use a real parser for the record count.
 let quoted=false,count=0;for(let i=0;i<csv.length;i++){if(csv[i]==='"'){if(quoted&&csv[i+1]==='"')i++;else quoted=!quoted;}if(csv[i]==='\n'&&!quoted)count++;}
 assert.equal(count,records);checks++;
 for(const filter of [{group:String(own.id)},{student:String(student.state.user.id)},{module:String(module)},{level:'A1'},{from:'2026-01-01',to:'2026-12-31'},{due:'2026-12-31',group:String(own.id)}]){
  const n=await page.evaluate(f=>{learningState.report=f;return reportRecords().length},filter);
  const text=await(await admin.ctx.get('/api/report?'+new URLSearchParams({...filter,format:'csv'}))).text();
  let q=false,lines=0;for(let i=0;i<text.length;i++){if(text[i]==='"'){if(q&&text[i+1]==='"')i++;else q=!q;}if(text[i]==='\n'&&!q)lines++;}
  assert.equal(lines,n,'report filter '+JSON.stringify(filter));checks++;
 }
 await page.goto('/#dashboard');await page.waitForSelector('[aria-label="План подготовки"]');
 await page.screenshot({path:path.join(__dirname,'artifacts/quality-dashboard.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'artifacts/quality-mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);checks++;
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 await page.screenshot({path:path.join(__dirname,'artifacts/quality-mobile-light.png'),fullPage:true});
 const statuses=await page.evaluate(()=>{
  const original=data;try{
   data=structuredClone(original);
   const uid=987654,gid=87654,mid=data.modules[0].id,lessons=data.lessons.filter(l=>l.module_id===mid&&l.published);
   data.members.push({user_id:uid,group_id:gid});data.assignments=data.assignments.filter(a=>a.group_id!==gid);
   data.lesson_progress=[];const result=[statusFor(uid,mid)];
   data.assignments.push({group_id:gid,module_id:mid,student_id:uid,due:'2020-01-01'});result.push(statusFor(uid,mid),assignmentOverdue(uid,mid));
   data.lesson_progress.push({user_id:uid,lesson_id:lessons[0].id});result.push(statusFor(uid,mid));
   data.attempts.push({user_id:uid,lesson_id:lessons[0].id,passed:false,score:0,created:new Date().toISOString()});result.push(statusFor(uid,mid));
   for(const l of lessons)data.attempts.push({user_id:uid,lesson_id:l.id,passed:true,score:100,created:new Date().toISOString()});
   result.push(statusFor(uid,mid),assignmentOverdue(uid,mid));return result;
  }finally{data=original;}
 });
 assert.deepEqual(statuses,['Не назначен','Назначен',true,'В процессе','Нужно повторить','Пройден',false]);checks++;
 console.log('PASS: '+checks+' quality checks; grading parity, individual scope, media reuse, import rollback, report parity, desktop/mobile.');
}finally{if(browser)await browser.close();for(const ctx of contexts)await ctx.dispose();}})().catch(e=>{console.error(e.message);process.exitCode=1});

const { request, chromium } = require('./playwright-runtime.cjs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const ps = (script,args) => execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve(__dirname,script),...args],{encoding:'utf8'});
(async()=>{
 const ctx=await request.newContext({baseURL:'http://localhost:5181'});
 let state=await(await ctx.get('/api/bootstrap')).json();
 const post=async(route,data)=>{const response=await ctx.post('/api/'+route,{data,headers:{'X-CSRF-Token':state.csrf}});assert.equal(response.status(),200,await response.text());return response.json();};
 const password='Operations-Test42!';
 await post('register',{email:'restore-'+stamp+'@example.test',password,first_name:'Restore',last_name:'Test'});
 state=await(await ctx.get('/api/bootstrap')).json();
 await post('notifications/test',{});
 const args=['-LegacyId',String(state.user.id),'-Stamp',stamp];
 const run=mode=>console.log(ps('restore-deletion.ps1',['-Mode',mode,...args]).trim());
 run('Prepare');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({storageState:await ctx.storageState()});
  page.on('dialog',d=>d.accept());
  await page.goto('http://localhost:5181/#account');
  await page.waitForFunction(()=>typeof data!=='undefined'&&data.user);
  const uid=state.user.id;
  await page.evaluate(async id=>{
   await offlineSet('snapshot-'+id,{private:true});await offlineSet('queue-'+id,[{private:true}]);
   localStorage.setItem('lw-progress-'+id,'{}');sessionStorage.setItem('tt-result-'+id,'{}');
  },uid);
  await page.evaluate(async password=>{
   const form=document.createElement('form'),field=document.createElement('input');field.name='password';field.value=password;form.append(field);await deleteAccount(form);
  },password);
  assert.equal(await page.evaluate(()=>data.user),null);
  const remains=await page.evaluate(async id=>[await offlineGet('snapshot-'+id),await offlineGet('queue-'+id),localStorage.getItem('lw-progress-'+id),sessionStorage.getItem('tt-result-'+id)].some(Boolean),uid);
  assert.equal(remains,false,'browser private account cache must be removed');
 }finally{await browser.close();}
 run('VerifyDeleted');
 run('Restore');
 console.log(ps('../scripts/reapply-deletions.ps1',['-RestoredDatabase','LingWay_StagingDeletion'+stamp]).trim());
 console.log(ps('../scripts/reapply-deletions.ps1',['-RestoredDatabase','LingWay_StagingDeletion'+stamp]).trim());
 run('VerifyRestored');run('Cleanup');
 await ctx.dispose();
 console.log('PASS: backup before deletion -> API deletion -> actual restore -> ledger replay -> no resurrected account/migration data; integrity checks pass.');
})().catch(e=>{console.error(e);process.exitCode=1;});

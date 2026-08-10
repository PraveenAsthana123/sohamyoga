import { chromium } from '../integrations/paperclip/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const base=process.env.SOHAM_BASE_URL||'http://127.0.0.1:8085';
const paths=process.argv.slice(2).length?process.argv.slice(2):['/','/catalog','/booking','/membership','/customer/login','/auth/login','/admin/module-assurance','/admin/architecture-center'];
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const results=[];
for(const path of paths){const page=await browser.newPage();const issues=[];page.on('console',m=>{if(m.type()==='error')issues.push({type:'console',text:m.text().slice(0,500)})});page.on('pageerror',e=>issues.push({type:'pageerror',text:e.message.slice(0,500)}));let status=0;try{const r=await page.goto(base+path,{waitUntil:'networkidle',timeout:45000});status=r?.status()||0;await page.waitForTimeout(500)}catch(e){issues.push({type:'navigation',text:e.message.slice(0,500)})}results.push({path,status,issues});await page.close()}
await browser.close();
console.log(JSON.stringify({generatedAt:new Date().toISOString(),base,results,summary:{pages:results.length,httpFailures:results.filter(x=>x.status<200||x.status>=400).length,consoleErrors:results.reduce((n,x)=>n+x.issues.length,0)}},null,2));
if(results.some(x=>x.status<200||x.status>=400||x.issues.length))process.exitCode=1;

import {Stagehand} from '@browserbasehq/stagehand';
const baseURL=process.env.SOHAM_BASE_URL||'http://127.0.0.1:8085';const gateway=process.env.SOHAM_OLLAMA_GATEWAY_URL||'http://127.0.0.1:8091/v1';const model=process.env.STAGEHAND_MODEL||'qwen2.5:latest';
async function main(){
 const stagehand=new Stagehand({env:'LOCAL',disableAPI:true,selfHeal:true,verbose:0,model:{modelName:`openai/${model}` as never,baseURL:gateway,apiKey:'ollama-local',openaiEndpointFormat:'chat'},localBrowserLaunchOptions:{headless:true,executablePath:'/usr/bin/google-chrome',chromiumSandbox:false,args:['--no-sandbox']},cacheDir:'test-results/stagehand-cache'});
 try{await stagehand.init();const page=stagehand.context.pages()[0];await page.goto(`${baseURL}/catalog`);const title=await page.title();let aiAction='skipped';if(process.env.STAGEHAND_AI==='1'){const result=await stagehand.observe('find the primary booking action without clicking it');aiAction=`observed ${result.length} action(s)`}console.log(JSON.stringify({status:'passed',engine:'Stagehand V3 local Chrome/CDP',selfHeal:true,title,aiAction,model,gateway},null,2))}finally{await stagehand.close({force:true})}
}
main().catch(error=>{console.error(error);process.exitCode=1});

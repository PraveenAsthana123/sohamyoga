import{CheerioCrawler,Dataset,RequestQueue,Configuration,log}from'crawlee';
import robotsParser from'robots-parser';
import{createHash}from'node:crypto';

const seed=process.argv[2];
if(!seed)throw new Error('Usage: crawler <public company website URL>');
const origin=new URL(seed).origin;
const blocked=['linkedin.com','facebook.com','instagram.com','x.com','twitter.com'];
if(blocked.some(host=>new URL(seed).hostname===host||new URL(seed).hostname.endsWith(`.${host}`)))throw new Error('Private/social-platform scraping is not supported. Supply the company public website.');
const max=Math.min(Number(process.env.CRAWL_MAX_PAGES||50),200);
const delay=Math.max(Number(process.env.CRAWL_DELAY_MS||1500),1000);
const agent='SohamYogaPublicBusinessResearch/1.0 (+contact: website-owner)';
let robots=robotsParser(`${origin}/robots.txt`,'');
try{const response=await fetch(`${origin}/robots.txt`,{headers:{'user-agent':agent},signal:AbortSignal.timeout(10000)});robots=robotsParser(`${origin}/robots.txt`,response.ok?await response.text():'')}catch{}
if(!robots.isAllowed(seed,agent))throw new Error('robots.txt disallows the seed URL');

const config=new Configuration({storageClientOptions:{localDataDirectory:'/data/crawlee'}});
const originKey=createHash('sha256').update(origin).digest('hex').slice(0,12);
const queue=await RequestQueue.open(`crawl-${originKey}-${Date.now()}`,{config});
const runId=(process.env.CRAWL_RUN_ID||String(Date.now())).replace(/[^a-zA-Z0-9_-]/g,'');
const dataset=await Dataset.open(`run-${runId}`,{config});
await queue.addRequest({url:seed});
const crawler=new CheerioCrawler({requestQueue:queue,maxRequestsPerCrawl:max,maxConcurrency:1,minConcurrency:1,requestHandlerTimeoutSecs:30,
 preNavigationHooks:[async({request})=>{if(new URL(request.url).origin!==origin||!robots.isAllowed(request.url,agent))throw new Error('URL outside allowed crawl boundary');await new Promise(resolve=>setTimeout(resolve,delay))}],
 async requestHandler({request,$,enqueueLinks}){
  $('script,style,noscript').remove();const text=$('body').text().replace(/\s+/g,' ').trim();
  const emails=[...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase()))].filter(x=>!x.endsWith('.png')&&!x.endsWith('.jpg'));
  const phones=[...new Set(text.match(/(?:\+?\d[\d ().-]{7,}\d)/g)||[])].slice(0,20);
  const socials=[...new Set($('a[href]').map((_,a)=>$(a).attr('href')).get().filter(h=>h&&blocked.some(host=>{try{return new URL(h,origin).hostname.includes(host)}catch{return false}})))];
  await dataset.pushData({sourceUrl:request.url,origin,title:$('title').text().trim().slice(0,300),description:$('meta[name="description"]').attr('content')?.slice(0,1000)||'',emails,phones,socialProfiles:socials,collectedAt:new Date().toISOString()});
  await enqueueLinks({strategy:'same-origin',transformRequestFunction:req=>robots.isAllowed(req.url,agent)?req:false});
 },failedRequestHandler({request,error}){log.warning(`Skipped ${request.url}: ${error.message}`)}} ,config);
await crawler.run();
log.info(`Completed bounded public crawl for ${origin}. Dataset: infrastructure/acquisition-crawler/data/crawlee/datasets/run-${runId}`);

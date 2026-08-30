import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { query, getPool } from '../src/lib/postgres';
const run=promisify(execFile);
async function main(){
  if(!process.env.DATABASE_URL){const env=await readFile('.env.local','utf8');for(const raw of env.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const i=line.indexOf('=');if(i>0&&!process.env[line.slice(0,i)])process.env[line.slice(0,i)]=line.slice(i+1).replace(/^(['"])(.*)\1$/,'$2')}}
  const workspace=await query<{id:string}>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  if(!workspace.rowCount)throw new Error('Marketing workspace missing');
  let healthy=false,details:Record<string,unknown>={};let activeChannels=0,registeredTrunks=0;
  try{
    const container=(await run('docker',['compose','-f','../infrastructure/asterisk/docker-compose.yml','ps','-q','asterisk'])).stdout.trim();
    if(!container)throw new Error('Asterisk container is not running');
    const health=(await run('docker',['inspect','--format','{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',container])).stdout.trim();
    const channels=(await run('docker',['compose','-f','../infrastructure/asterisk/docker-compose.yml','exec','-T','asterisk','asterisk','-rx','core show channels count'])).stdout;
    const endpoints=(await run('docker',['compose','-f','../infrastructure/asterisk/docker-compose.yml','exec','-T','asterisk','asterisk','-rx','pjsip show endpoints'])).stdout;
    activeChannels=Number(channels.match(/(\d+) active channel/)?.[1]||0);
    registeredTrunks=(endpoints.match(/\sAvail\s/g)||[]).length;
    healthy=health==='healthy';details={health,endpointObjects:Number(endpoints.match(/Objects found: (\d+)/)?.[1]||0)};
  }catch(error){details={error:error instanceof Error?error.message:String(error)};}
  const queued=await query<{count:number}>(`SELECT count(*)::int count FROM voice_call WHERE workspace_id=$1 AND status IN('scheduled','ringing')`,[workspace.rows[0].id]);
  await query(`INSERT INTO voice_monitor_snapshot(workspace_id,healthy,active_channels,registered_trunks,queued_calls,details) VALUES($1,$2,$3,$4,$5,$6)`,[workspace.rows[0].id,healthy,activeChannels,registeredTrunks,queued.rows[0].count,JSON.stringify(details)]);
  console.log(JSON.stringify({healthy,activeChannels,registeredTrunks,queuedCalls:queued.rows[0].count,details}));
  await getPool().end();
}
main().catch(error=>{console.error(error);process.exit(1)});

import {NextRequest} from 'next/server';
import {POST} from '@/app/api/mcp/social/route';
import {getAdminPrincipal} from '@/lib/admin-auth';
import {query,transaction} from '@/lib/postgres';
jest.mock('@/lib/admin-auth',()=>({getAdminPrincipal:jest.fn()}));
jest.mock('@/lib/postgres',()=>({query:jest.fn(),transaction:jest.fn()}));
const sql=jest.fn();const id='d894e787-cd8c-47ea-9909-e3125c147639';
function req(tool:string,input:Record<string,unknown>={}){return new NextRequest('https://portal.example/api/mcp/social',{method:'POST',body:JSON.stringify({tool,input:{draftId:id,...input}})});}
beforeEach(()=>{jest.resetAllMocks();(getAdminPrincipal as jest.Mock).mockResolvedValue({principal:{id,roles:['Admin']}});(transaction as jest.Mock).mockImplementation(fn=>fn({query:sql}));});
it.each(['preview_post','draft_reply','pause_campaign'])('%s does not invent an action result',async tool=>{const r=await POST(req(tool,{confirmApprovalId:'test'}));expect(r.status).toBe(200);expect((await r.json()).result.supported).toBe(false);expect(query).not.toHaveBeenCalled();});
it('queues locally once and rejects reused approval',async()=>{
 (query as jest.Mock).mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:0});
 sql.mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:1,rows:[{platform:'facebook',postiz_account_id:'p',status:'pending',account_status:'connected'}]}).mockResolvedValueOnce({rowCount:0}).mockResolvedValue({});
 const r=await POST(req('publish_post',{confirmApprovalId:'token'}));expect(r.status).toBe(200);expect((await r.json()).result.status).toBe('queued_locally');
 const retry=await POST(req('publish_post',{confirmApprovalId:'token'}));expect(retry.status).toBe(403);expect(transaction).toHaveBeenCalledTimes(1);
});
it('rejects unsupported or disconnected variant without dropping it',async()=>{
 (query as jest.Mock).mockResolvedValue({rowCount:1});sql.mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:1,rows:[{platform:'facebook',postiz_account_id:null,status:'pending',account_status:'expired'}]});
 expect((await POST(req('publish_post',{confirmApprovalId:'token'}))).status).toBe(500);expect(sql).toHaveBeenCalledTimes(2);
});

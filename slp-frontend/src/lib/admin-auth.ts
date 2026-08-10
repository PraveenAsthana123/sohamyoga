import { NextRequest } from 'next/server';
import { SERVER_API_URL } from './server-api';

export type AdminPrincipal={id:string;email?:string;roles:string[]};

export async function getAdminPrincipal(req:NextRequest):Promise<{principal?:AdminPrincipal;denied?:Response}>{
 try{
  const response=await fetch(`${SERVER_API_URL}/api/auth/me`,{headers:{cookie:req.headers.get('cookie')||''},cache:'no-store',signal:AbortSignal.timeout(5_000)});
  if(!response.ok)return{denied:Response.json({error:'Authentication required.'},{status:401})};
  const user=await response.json() as AdminPrincipal;
  if(!user.roles?.some(role=>['Admin','Editor','Sales'].includes(role)))return{denied:Response.json({error:'Marketing administrator access is required.'},{status:403})};
  return{principal:user};
 }catch{return{denied:Response.json({error:'Authentication service is unavailable.'},{status:503})}}
}

export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  const result=await getAdminPrincipal(req);return result.denied||null;
}

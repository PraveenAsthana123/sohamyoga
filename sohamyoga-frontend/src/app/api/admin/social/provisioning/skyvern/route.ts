import {NextRequest} from 'next/server';
import {requireAdmin} from '@/lib/admin-auth';
import {skyvernHealth} from '@/lib/skyvern';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const denied=await requireAdmin(req);if(denied)return denied;try{return Response.json(await skyvernHealth())}catch(error){return Response.json({healthy:false,error:error instanceof Error?error.message:'Skyvern unavailable'},{status:503})}}


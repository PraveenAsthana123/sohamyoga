import {NextRequest,NextResponse} from 'next/server';

// Meta returns OAuth data here; Postiz owns state validation and token exchange.
// Never log the query because it may contain an authorization code.
export function GET(req:NextRequest){
 const target=process.env.POSTIZ_INTERNAL_URL||process.env.POSTIZ_CLIENT_URL;
 if(!target)return NextResponse.json({error:'Facebook connector is not running. Configure POSTIZ_CLIENT_URL and start Postiz.'},{status:503});
 let destination:URL;
 try{destination=new URL('/api/socials/facebook/callback',target)}catch{return NextResponse.json({error:'POSTIZ_CLIENT_URL is invalid'},{status:503})}
 req.nextUrl.searchParams.forEach((value,key)=>destination.searchParams.set(key,value));
 return NextResponse.redirect(destination);
}

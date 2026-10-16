import {NextRequest,NextResponse} from 'next/server';
import {getSentimentReport,type SentimentInterval} from '@/lib/sentiment';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const interval=request.nextUrl.searchParams.get('interval')??'1h';
 if(!['1h','4h','1d'].includes(interval))return NextResponse.json({error:'Invalid interval'}, {status:400});
 try {const report=await getSentimentReport(interval as SentimentInterval);
 return NextResponse.json(report,{headers:{'Cache-Control':'no-store'}});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Sentiment unavailable'},{status:502});}
}

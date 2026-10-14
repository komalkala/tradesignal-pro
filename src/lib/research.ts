import type {ProBacktestResult,SimTrade} from './pro-backtest';

export function summarizeTrades(trades:SimTrade[],startBalance:number){
 let balance=startBalance,peak=startBalance,maxDrawdown=0,win=0,grossProfit=0,grossLoss=0,fees=0;
 for(const t of trades){balance+=t.pnl;peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,peak>0?(peak-balance)/peak*100:0);fees+=t.fee;
  if(t.pnl>0){win++;grossProfit+=t.pnl}else if(t.pnl<0)grossLoss-=t.pnl;
 }
 return {trades:trades.length,endingBalance:balance,netReturnPct:startBalance>0?(balance/startBalance-1)*100:0,winRatePct:trades.length?win/trades.length*100:0,maxDrawdownPct:maxDrawdown,profitFactor:grossLoss>0?grossProfit/grossLoss:null,expectancy:trades.length?(balance-startBalance)/trades.length:0,fees};
}
/** Chronological OOS split. These statistics are descriptive; they do not optimize the strategy. */
export function analyzeOutOfSample(result:ProBacktestResult,holdoutStart:number){
 const training=result.trades.filter(t=>t.signalTime<holdoutStart);
 const holdout=result.trades.filter(t=>t.signalTime>=holdoutStart);
 const a=summarizeTrades(training,result.startingBalance);
 const b=summarizeTrades(holdout,a.endingBalance);
 const reasons:string[]=[];
 if(training.length<30)reasons.push('Training sample fewer than 30 trades');
 if(holdout.length<30)reasons.push('Out-of-sample sample fewer than 30 trades');
 if(b.expectancy<=0)reasons.push('Out-of-sample net expectancy is not positive');
 if(b.maxDrawdownPct>15)reasons.push('Out-of-sample drawdown above 15%');
 return {splitAt:new Date(holdoutStart).toISOString(),training:a,holdout:b,validation:'RESEARCH_ONLY' as const,insufficientEvidence:reasons.length>0,reasons};
}

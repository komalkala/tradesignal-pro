import type {SimTrade} from './pro-backtest';
export type PerformanceReport={trades:number;wins:number;winRate:number;netPnl:number;expectancy:number;profitFactor:number|null;maxDrawdownPct:number;averageHoldMinutes:number};
export function performanceMetrics(trades:Pick<SimTrade,'pnl'|'entryTime'|'exitTime'>[],startingBalance=750):PerformanceReport{
 let balance=startingBalance,peak=startingBalance,drawdown=0,gain=0,loss=0,wins=0,hold=0;
 for(const t of trades){if(t.pnl>0){gain+=t.pnl;wins++}else loss+=-t.pnl;
 balance+=t.pnl;peak=Math.max(peak,balance);drawdown=Math.max(drawdown,peak>0?100*(peak-balance)/peak:0);
 hold+=Math.max(0,t.exitTime-t.entryTime)/60000;
 }
 return {trades:trades.length,wins,winRate:trades.length?100*wins/trades.length:0,netPnl:balance-startingBalance,expectancy:trades.length?(balance-startingBalance)/trades.length:0,profitFactor:loss>0?gain/loss:gain>0?null:0,maxDrawdownPct:drawdown,averageHoldMinutes:trades.length?hold/trades.length:0};
}

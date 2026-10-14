import {indicatorSeries} from './indicators';
import {generateSignal} from './strategy';
import type {Candle,Side,StrategySettings} from './types';
export type Trade={side:Side;opened:number;closed:number;entry:number;exit:number;stop:number;target:number;pnl:number;reason:string};
export type BacktestResult={trades:Trade[];totalReturn:number;winRate:number;maxDrawdown:number;profitFactor:number|null;endingEquity:number;startEquity:number;assumptions:string[]};
export function backtest(candles:Candle[],settings:StrategySettings):BacktestResult {
  const indicators=indicatorSeries(candles);let equity=settings.accountSize,peak=equity,maxDD=0,gains=0,losses=0;
  const trades:Trade[]=[]; let active:null|{side:Side;opened:number;entry:number;stop:number;target:number;qty:number;entryFee:number}=null;
  // Signal uses only fully closed candle at i; entry on the following candle's open.
  for(let i=201;i<candles.length-1;i++){
    const c=candles[i];
    if(active){
      // Check only following candles; pessimistic if stop and target both touched.
      const stopHit=active.side==='LONG'?c.low<=active.stop:c.high>=active.stop;
      const targetHit=active.side==='LONG'?c.high>=active.target:c.low<=active.target;
      if(stopHit||targetHit){
        const baseExit=stopHit?active.stop:active.target;
        const exit=baseExit*(active.side==='LONG'?1-settings.slippageRate:1+settings.slippageRate);
        const gross=(exit-active.entry)*active.qty*(active.side==='LONG'?1:-1);
        const fees=active.entryFee+exit*active.qty*settings.feeRate;
        const pnl=gross-fees;equity+=pnl;gains+=Math.max(pnl,0);losses+=Math.max(-pnl,0);
        trades.push({side:active.side,opened:active.opened,closed:c.time,entry:active.entry,exit,stop:active.stop,target:active.target,pnl,reason:stopHit?'Stop':'Target'});
        peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak*100);active=null;
      }
    }
    if(active||equity<=0)continue;
    const sig=generateSignal(c,indicators[i],settings);
    if(sig.decision==='WAIT'||sig.riskDistance===null)continue;
    const next=candles[i+1]; const entry=next.open*(sig.decision==='LONG'?1+settings.slippageRate:1-settings.slippageRate);
    const distance=sig.riskDistance;
    const stop=sig.decision==='LONG'?entry-distance:entry+distance;
    const target=sig.decision==='LONG'?entry+distance*settings.rewardRatio:entry-distance*settings.rewardRatio;
    const qty=(equity*settings.riskPercent/100)/distance;
    active={side:sig.decision,opened:next.time,entry,stop,target,qty,entryFee:entry*qty*settings.feeRate};
    // Trade starts at the next candle open; prevent checking this candle in current iteration.
  }
  if(active){const c=candles[candles.length-1];const exit=c.close*(active.side==='LONG'?1-settings.slippageRate:1+settings.slippageRate);const pnl=(exit-active.entry)*active.qty*(active.side==='LONG'?1:-1)-active.entryFee-exit*active.qty*settings.feeRate;equity+=pnl;gains+=Math.max(pnl,0);losses+=Math.max(-pnl,0);trades.push({side:active.side,opened:active.opened,closed:c.time,entry:active.entry,exit,stop:active.stop,target:active.target,pnl,reason:'End of data'});peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak*100);}
  const wins=trades.filter(t=>t.pnl>0).length;
  return {trades,totalReturn:(equity/settings.accountSize-1)*100,winRate:trades.length?wins/trades.length*100:0,maxDrawdown:maxDD,profitFactor:losses>0?gains/losses:gains>0?null:0,endingEquity:equity,startEquity:settings.accountSize,assumptions:['Closed-candle indicators; entry at next open','Intrabar stop/target: stop wins ties','Flat percentage taker fees and slippage on both sides','No funding, liquidation, exchange filters, spread, partial fills or portfolio overlap','Single position at a time; example strategy not validated out of sample']};
}

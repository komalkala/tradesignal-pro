import type { Candle, Indicators, Signal, StrategySettings, Side } from "./types";
export function generateSignal(c:Candle, i:Indicators, s:StrategySettings):Signal {
  const ready=[i.ema20,i.ema50,i.ema200,i.rsi,i.macdHistogram,i.atr,i.volumeRatio].every(Number.isFinite);
  if(!ready||i.atr<=0)return {decision:"WAIT",reasons:["Waiting for sufficient historical candles"],indicators:i,entry:null,stop:null,target:null,riskDistance:null,candleTime:c.time,score:0};
  const up=i.ema20>i.ema50&&c.close>i.ema200,down=i.ema20<i.ema50&&c.close<i.ema200;
  const bullishRSI=i.rsi>=50&&i.rsi<=70,bearishRSI=i.rsi>=30&&i.rsi<=50;
  const bullMACD=i.macdHistogram>0,bearMACD=i.macdHistogram<0,volume=i.volumeRatio>=1.05;
  const longVotes=[up,bullishRSI,bullMACD,volume].filter(Boolean).length;
  const shortVotes=[down,bearishRSI,bearMACD,volume].filter(Boolean).length;
  const decision:Side|"WAIT"=longVotes===4?"LONG":shortVotes===4?"SHORT":"WAIT";
  const reasons=[up?"Bullish EMA alignment":down?"Bearish EMA alignment":"EMA trend is mixed",`RSI ${i.rsi.toFixed(1)}`,bullMACD?"MACD momentum bullish":"MACD momentum bearish",`Volume ${i.volumeRatio.toFixed(2)}× 20-bar average`];
  const distance=i.atr*s.atrMultiple;
  return {decision,reasons,indicators:i,entry:decision==="WAIT"?null:c.close,stop:decision==="LONG"?c.close-distance:decision==="SHORT"?c.close+distance:null,target:decision==="LONG"?c.close+distance*s.rewardRatio:decision==="SHORT"?c.close-distance*s.rewardRatio:null,riskDistance:decision==="WAIT"?null:distance,candleTime:c.time,score:Math.max(longVotes,shortVotes)*25};
}
export function positionSizing(entry:number,stop:number,settings:StrategySettings){
  const riskUsd=settings.accountSize*settings.riskPercent/100;
  const distance=Math.abs(entry-stop); if(distance<=0)return null;
  const qty=riskUsd/distance;const notional=qty*entry;
  return {riskUsd,quantity:qty,notional,marginAt5x:notional/5,leverageIllustration:5};
}

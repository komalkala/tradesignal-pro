import type {SimTrade} from './pro-backtest';
import {performanceMetrics} from './performance-metrics';
// Chronological evaluation for a LOCKED strategy, NOT parameter optimization.
// A trade is attributed to the period in which its signal was issued.
export function chronologicalValidation(trades:SimTrade[],historyStart:number,historyEnd:number,folds=4){
 if(!Number.isFinite(historyStart)||!Number.isFinite(historyEnd)||historyEnd<=historyStart)throw Error('Invalid history range');
 if(!Number.isInteger(folds)||folds<2||folds>12)throw Error('Invalid fold count');
 const ordered=[...trades].sort((a,b)=>a.signalTime-b.signalTime);
 const size=(historyEnd-historyStart)/folds;
 const windows=Array.from({length:folds},(_,index)=>{
  const start=historyStart+size*index,end=index===folds-1?historyEnd:historyStart+size*(index+1);
  const sample=ordered.filter(t=>t.signalTime>=start&&t.signalTime<(index===folds-1?end+1:end));
  return {start:new Date(start).toISOString(),end:new Date(end).toISOString(),metrics:performanceMetrics(sample)};
 });
 return {kind:'CHRONOLOGICAL_LOCKED_RULE_EVALUATION' as const,windows,adequateEvidence:windows.every(w=>w.metrics.trades>=30),note:'No parameter fitting or actual walk-forward optimization is performed. Results are descriptive; 30 trades per window is an illustrative minimum.'};
}

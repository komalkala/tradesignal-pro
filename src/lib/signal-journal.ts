import type {Quality} from './pro';
import type {SymbolId,Interval} from './types';
export type JournalRecord={key:string;symbol:SymbolId;interval:Interval;candleTime:number;decision:Quality['decision'];score:number;longScore:number;shortScore:number;vetoes:string[]};
// Deterministic, pure journal record builder; consumer may persist it as JSONL.
export function journalRecord(symbol:SymbolId,interval:Interval,candleTime:number,signal:Quality):JournalRecord{
 return {key:`${symbol}:${interval}:${candleTime}`,symbol,interval,candleTime,decision:signal.decision,score:signal.score,longScore:signal.longScore,shortScore:signal.shortScore,vetoes:[...signal.vetoes]};
}

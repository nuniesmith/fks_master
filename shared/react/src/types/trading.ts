// <types:autogen start>
export interface TradeSignal {
  symbol: string;
  side: 'LONG' | 'SHORT';
  strength: number; // 0..1
  timestamp: string;
  strategy: string;
  meta?: Record<string, unknown>;
}
// <types:autogen end>

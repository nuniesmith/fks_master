import { useEnv } from '../hooks/useEnv';

export const getRiskThreshold = (equity: number = 1): number => {
  const val = useEnv('RISK_MAX_PER_TRADE');
  const pct = val ? parseFloat(val) : 0.01;
  return equity * pct;
};

export const useEnv = (key: string): string | undefined => {
  const viteKey = `VITE_${key}`;
  // @ts-ignore
  const viteEnv = typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, string | undefined>) : {};
  return viteEnv[viteKey] || (typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>)[key] : undefined);
};

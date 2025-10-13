export const getMetaValue = <T = any>(
  meta: Map<string, T> | Record<string, T> | null | undefined,
  key: string
): T | undefined => {
  if (!meta) return undefined;
  return meta instanceof Map ? meta.get(key) : meta[key];
};

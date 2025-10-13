export const getMetaValue = (meta: any, key: string) => {
  if (!meta) return undefined;
  return typeof meta.get === "function" ? meta.get(key) : meta[key];
};

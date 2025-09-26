const randomString = (length: number) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

// Helper: encode propertyId into base36 (alphanumeric only)
const encodePropertyId = (propertyId: string) => {
  return BigInt("0x" + propertyId).toString(36); // hex -> base36
};

// Helper: decode propertyId back (useful for middleware later)
const decodePropertyId = (encoded: string) => {
  return BigInt("0x" + parseInt(encoded, 36).toString(16)).toString(16);
};

export { randomString, encodePropertyId, decodePropertyId };

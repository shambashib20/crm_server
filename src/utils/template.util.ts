const parseTemplate = (
  template:
    | string
    | { message: string; meta?: { variable_map?: Record<string, string> } },
  data: Record<string, any>
) => {
  const text = typeof template === "string" ? template : template.message || "";

  const variableMap =
    typeof template === "string" ? {} : template.meta?.variable_map || {};

  return text.replace(/{{(\d+)}}/g, (_, key) => {
    const variableName = variableMap[key];
    return data[variableName] || "";
  });
};

export { parseTemplate };

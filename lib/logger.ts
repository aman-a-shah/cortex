type Level = "info" | "warn" | "error";

function log(level: Level, module: string, message: string, data?: unknown) {
  const prefix = `[${module}]`;
  if (level === "error") console.error(prefix, message, ...(data !== undefined ? [data] : []));
  else if (level === "warn") console.warn(prefix, message, ...(data !== undefined ? [data] : []));
  else console.log(prefix, message, ...(data !== undefined ? [data] : []));
}

export const logger = {
  info:  (module: string, message: string, data?: unknown) => log("info",  module, message, data),
  warn:  (module: string, message: string, data?: unknown) => log("warn",  module, message, data),
  error: (module: string, message: string, data?: unknown) => log("error", module, message, data),
};

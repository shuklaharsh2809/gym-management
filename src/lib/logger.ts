type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

// Structured JSON logs. Never pass passwords, tokens or personal/financial details as fields.
function write(level: Level, message: string, fields?: Fields) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const entry = { level, time: new Date().toISOString(), message, ...fields };
  const line = JSON.stringify(entry, (_key, value) =>
    value instanceof Error
      ? { name: value.name, message: value.message, stack: value.stack }
      : value,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

const priorities = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({ level = "info", service = "fieldline-api" } = {}) {
  const minimum = priorities[level] ?? priorities.info;

  function write(levelName, message, fields = {}) {
    if ((priorities[levelName] ?? 100) < minimum) return;
    const record = {
      timestamp: new Date().toISOString(),
      level: levelName,
      service,
      message,
      ...fields
    };
    const line = JSON.stringify(record);
    if (levelName === "error") console.error(line);
    else if (levelName === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields)
  };
}

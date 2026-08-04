const DEFAULT_CLIENT_ORIGINS = ["http://localhost:5173"];

export function getAllowedOrigins(value = process.env.CLIENT_ORIGIN) {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : DEFAULT_CLIENT_ORIGINS;
}

export function isOriginAllowed(origin, allowedOrigins) {
  // Requests without an Origin header are typically same-origin, CLI, or
  // server-to-server requests and do not need browser CORS permission.
  return !origin || allowedOrigins.includes(origin);
}

export function createCorsOptions(allowedOrigins) {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  };
}

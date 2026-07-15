import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

const nodeEnv = optionalEnv('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  port: parseInt(optionalEnv('PORT', '4000'), 10),

  mongoUri: requireEnv('MONGO_URI'),

  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  jwtRefreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  refreshCookieName: optionalEnv('REFRESH_COOKIE_NAME', 'accessflow_refresh_token'),

  corsOrigins: optionalEnv('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  authRateLimitWindowMs: parseInt(optionalEnv('AUTH_RATE_LIMIT_WINDOW_MS', '900000'), 10),
  authRateLimitMax: parseInt(optionalEnv('AUTH_RATE_LIMIT_MAX', '20'), 10),

  logLevel: optionalEnv('LOG_LEVEL', 'info'),

  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
} as const;

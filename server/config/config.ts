export const config = {
  server: {
    port: Number(process.env.PORT) || 8080,
    host: process.env.HOST || '::',
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  },
  security: {
    helmet: {
      contentSecurityPolicy: false,
    },
  },
};

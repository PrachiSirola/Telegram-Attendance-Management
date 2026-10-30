import { defineConfig, loadEnv, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

const logger = createLogger();
const originalError = logger.error;
logger.error = (msg, options) => {
  if (
    options?.error?.code === 'ECONNRESET' ||
    options?.error?.code === 'ECONNREFUSED' ||
    options?.error?.message?.includes('ECONNRESET') ||
    (typeof msg === 'string' &&
      (msg.includes('ECONNRESET') ||
        msg.includes('ws proxy socket error') ||
        msg.includes('ws proxy error')))
  ) {
    return;
  }

  originalError(msg, options);
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const port = Number.parseInt(env.PORT || '1001', 10);
  const backendUrl = env.BACKEND_URL || env.API_PROXY_TARGET || 'http://localhost:1002';

  const proxyConfig = {
    '/api': {
      target: backendUrl,
      changeOrigin: true,
    },
    '/uploads': {
      target: backendUrl,
      changeOrigin: true,
    },
    '/socket.io': {
      target: backendUrl,
      changeOrigin: true,
      ws: true,
      configure: (proxy) => {
        proxy.on('error', (err) => {
          if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
          console.error('[ws proxy error]', err.message);
        });

        proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
          socket.on('error', (err) => {
            if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
            console.error('[ws socket error]', err.message);
          });
        });
      },
    },
  };

  return {
    customLogger: logger,
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            charts: ['recharts'],
          },
        },
      },
    },
    server: {
      host: true,
      port,
      allowedHosts: ['orlix.online', '.orlix.online'],
      proxy: proxyConfig,
    },
    preview: {
      host: true,
      port,
      allowedHosts: ['orlix.online', '.orlix.online'],
      proxy: proxyConfig,
    },
  };
});

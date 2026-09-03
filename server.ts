/**
 * ITI College CBT Examination System - Development Server
 * 
 * DEVELOPMENT-ONLY SERVER:
 * In production, Firebase Cloud Functions (`functions/index.js`) and Firebase Hosting (`firebase.json`)
 * are the sole authoritative production backend.
 * 
 * To prevent duplicate/divergent logic, this development server delegates all `/api/*`
 * requests directly to the exact same Express app exported from `functions/index.js`.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Import the single source of truth Express app from functions/index.js
  let functionsApp;
  try {
    const functionsModule = require('./functions/index.js');
    functionsApp = functionsModule.app;
  } catch (err) {
    console.warn('[DEV SERVER] Could not load functions/index.js directly:', (err as Error).message);
  }

  // Mount production Cloud Functions API router at /api
  if (functionsApp) {
    app.use('/api', functionsApp);
    // Also catch any direct requests to /settings without /api prefix
    app.use('/settings', (req, res, next) => {
      req.url = '/settings';
      functionsApp(req, res, next);
    });
  } else {
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', mode: 'development' });
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CBT SERVER] Running on port ${PORT}`);
  });
}

startServer();

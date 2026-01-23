import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
config();

// Auto-detect environment based on version if NODE_ENV not explicitly set
const version = process.env.VERSION || process.env.npm_package_version || '0.0.0';
const isPreRelease = /alpha|beta|dev|rc/i.test(version);
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = isPreRelease ? 'development' : 'production';
}

// Import routes
import healthRoutes from './api/health.js';
import setupRoutes from './api/setup.js';
import settingsRoutes from './api/settings.js';
import mediaServerRoutes from './api/media-servers.js';
import arrRoutes from './api/arr.js';
import rulesRoutes from './api/rules.js';
import collectionsRoutes from './api/collections.js';
import notificationsRoutes from './api/notifications.js';
import systemRoutes from './api/system.js';
import statisticsServicesRoutes from './api/statistics-services.js';
import storageRoutes from './api/storage.js';
import presetsRoutes from './api/presets.js';
import leavingSoonRoutes from './api/leaving-soon.js';
import pathMappingsRoutes from './api/path-mappings.js';
import mediaPathsRoutes from './api/media-paths.js';
import { leavingSoonService } from './services/leavingSoonService.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware - Configure Helmet with CSP for React SPA
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // React/Tailwind may use inline styles
      imgSrc: ["'self'", "data:", "https:"], // Allow data URIs and external images (posters)
      connectSrc: ["'self'"], // API calls to same origin
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null, // Don't force HTTPS upgrade - allow HTTP for local/internal deployments
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external images
  crossOriginOpenerPolicy: false, // Disable COOP to prevent issues with popups/redirects
}));
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (message) => logger.http(message.trim()) } }));

// API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/media-servers', mediaServerRoutes);
app.use('/api/v1/arr', arrRoutes);
app.use('/api/v1/rules', rulesRoutes);
app.use('/api/v1/collections', collectionsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/statistics-services', statisticsServicesRoutes);
app.use('/api/v1/storage-sources', storageRoutes);
app.use('/api/v1/presets', presetsRoutes);
app.use('/api/v1/leaving-soon', leavingSoonRoutes);
app.use('/api/v1/path-mappings', pathMappingsRoutes);
app.use('/api/v1/media-paths', mediaPathsRoutes);

// Serve static files (always serve if dist/client exists)
{
  // The compiled server is at dist/server/server/index.js
  // and the client is at dist/client/
  const clientPath = path.join(process.cwd(), 'dist', 'client');
  
  // Debug: Log the client path and check if it exists
  logger.info(`Static files path: ${clientPath}`, 'System');
  
  if (fs.existsSync(clientPath)) {
    const files = fs.readdirSync(clientPath);
    logger.info(`Client directory contents: ${files.join(', ')}`, 'System');
    
    const assetsPath = path.join(clientPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      const assetFiles = fs.readdirSync(assetsPath);
      logger.info(`Assets directory contents: ${assetFiles.join(', ')}`, 'System');
    } else {
      logger.warn(`Assets directory not found at: ${assetsPath}`, 'System');
    }
  } else {
    logger.error(`Client directory not found at: ${clientPath}`, 'System');
  }
  
  // Serve static assets
  app.use(express.static(clientPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(clientPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      logger.error(`index.html not found at: ${indexPath}`, 'System');
      res.status(500).send('Frontend not found. Check build configuration.');
    }
  });
}

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Sweeparr server started on port ${PORT}`, 'System');
  logger.info(`Version: ${version}`, 'System');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}${isPreRelease ? ' (auto-detected from version)' : ''}`, 'System');
  logger.info(`Working directory: ${process.cwd()}`, 'System');
  
  // Start Leaving Soon auto-sync after a short delay to let DB initialize
  setTimeout(() => {
    leavingSoonService.startAutoSync().catch(err => {
      logger.error(`Failed to start Leaving Soon auto-sync: ${err}`, 'System');
    });
  }, 5000);
});

export default app;

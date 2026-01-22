import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
config();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external images
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '..', 'client');
  
  // Serve static assets
  app.use(express.static(clientPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Sweeparr server started on port ${PORT}`, 'System');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`, 'System');
  
  // Start Leaving Soon auto-sync after a short delay to let DB initialize
  setTimeout(() => {
    leavingSoonService.startAutoSync().catch(err => {
      logger.error(`Failed to start Leaving Soon auto-sync: ${err}`, 'System');
    });
  }, 5000);
});

export default app;

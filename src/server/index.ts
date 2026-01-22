import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
config();

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

// Middleware
app.use(helmet());
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
  app.use(express.static('dist/client'));
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'dist/client' });
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

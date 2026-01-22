import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const router = Router();

// Check if initial setup is complete
router.get('/status', async (req, res, next) => {
  try {
    const setupComplete = await prisma.settings.findUnique({
      where: { key: 'setup.complete' },
    });
    
    res.json({
      success: true,
      data: {
        setupComplete: setupComplete?.value === 'true',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Complete initial setup
router.post('/complete', async (req, res, next) => {
  try {
    const { instanceName, username, password, authentication } = req.body;
    
    // Validate required fields
    if (!instanceName) {
      throw createError('Instance name is required', 400);
    }
    
    if (authentication !== 'none' && (!username || !password)) {
      throw createError('Username and password are required when authentication is enabled', 400);
    }
    
    // Check if setup is already complete
    const existingSetup = await prisma.settings.findUnique({
      where: { key: 'setup.complete' },
    });
    
    if (existingSetup?.value === 'true') {
      throw createError('Setup has already been completed', 400);
    }
    
    // Generate API key
    const apiKey = crypto.randomBytes(16).toString('hex');
    
    // Hash password if provided (simple hash for now - should use bcrypt in production)
    const hashedPassword = password ? 
      crypto.createHash('sha256').update(password).digest('hex') : '';
    
    // Save all settings
    const settingsToSave = [
      { key: 'setup.complete', value: 'true' },
      { key: 'general.instanceName', value: instanceName },
      { key: 'general.authentication', value: authentication || 'none' },
      { key: 'general.username', value: username || '' },
      { key: 'general.password', value: hashedPassword },
      { key: 'general.apiKey', value: apiKey },
      { key: 'general.urlBase', value: '' },
      { key: 'general.logLevel', value: 'info' },
      { key: 'general.backup.folder', value: 'Backups' },
      { key: 'general.backup.interval', value: '7' },
      { key: 'general.backup.retention', value: '28' },
    ];
    
    for (const setting of settingsToSave) {
      await prisma.settings.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: setting,
      });
    }
    
    logger.info(`Initial setup completed. Instance name: ${instanceName}`);
    
    res.json({
      success: true,
      data: {
        message: 'Setup completed successfully',
        instanceName,
        apiKey,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

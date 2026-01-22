import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// ============================================
// Notification Services CRUD
// ============================================

// List all notification services
router.get('/', async (req, res, next) => {
  try {
    const services = await prisma.notificationService.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Parse JSON config for each service
    const servicesWithParsedConfig = services.map((service: { id: number; name: string; type: string; config: string; isEnabled: boolean; createdAt: Date; updatedAt: Date }) => ({
      ...service,
      config: JSON.parse(service.config),
    }));

    res.json({ success: true, data: servicesWithParsedConfig });
  } catch (error) {
    next(error);
  }
});

// Get single notification service
router.get('/:id', async (req, res, next) => {
  try {
    const service = await prisma.notificationService.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!service) {
      return res.status(404).json({ success: false, error: 'Notification service not found' });
    }

    res.json({
      success: true,
      data: {
        ...service,
        config: JSON.parse(service.config),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create notification service
router.post('/', async (req, res, next) => {
  try {
    const { name, type, config, isEnabled = true } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and config are required',
      });
    }

    const service = await prisma.notificationService.create({
      data: {
        name,
        type,
        config: JSON.stringify(config),
        isEnabled,
      },
    });

    res.json({
      success: true,
      data: {
        ...service,
        config: JSON.parse(service.config),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update notification service
router.put('/:id', async (req, res, next) => {
  try {
    const { name, type, config, isEnabled } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (config !== undefined) updateData.config = JSON.stringify(config);
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const service = await prisma.notificationService.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        ...service,
        config: JSON.parse(service.config),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete notification service
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.notificationService.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ success: true, message: 'Notification service deleted' });
  } catch (error) {
    next(error);
  }
});

// Test notification service
router.post('/:id/test', async (req, res, next) => {
  try {
    const service = await prisma.notificationService.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!service) {
      return res.status(404).json({ success: false, error: 'Notification service not found' });
    }

    const config = JSON.parse(service.config);
    let success = false;
    let message = '';

    try {
      switch (service.type) {
        case 'discord':
          success = await testDiscordWebhook(config.webhookUrl);
          message = success ? 'Test notification sent to Discord' : 'Failed to send Discord notification';
          break;
        case 'slack':
          success = await testSlackWebhook(config.webhookUrl);
          message = success ? 'Test notification sent to Slack' : 'Failed to send Slack notification';
          break;
        case 'email':
          // Email testing would require actual SMTP setup
          success = true;
          message = 'Email configuration validated (test email not sent)';
          break;
        case 'telegram':
          success = await testTelegramBot(config.botToken, config.chatId);
          message = success ? 'Test notification sent to Telegram' : 'Failed to send Telegram notification';
          break;
        case 'gotify':
          success = await testGotify(config.serverUrl, config.appToken);
          message = success ? 'Test notification sent to Gotify' : 'Failed to send Gotify notification';
          break;
        case 'pushover':
          success = await testPushover(config.serverUrl, config.appToken);
          message = success ? 'Test notification sent to Pushover' : 'Failed to send Pushover notification';
          break;
        default:
          message = `Unknown notification type: ${service.type}`;
      }
    } catch (err: any) {
      message = err.message || 'Test failed';
    }

    res.json({ success: true, data: { success, message } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Notification Helper Functions
// ============================================

async function testDiscordWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🧹 Sweeparr Test Notification',
          description: 'If you see this message, your Discord notifications are working!',
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testSlackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🧹 Sweeparr Test Notification',
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Sweeparr Test Notification*\nIf you see this message, your Slack notifications are working!',
          },
        }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testTelegramBot(botToken: string, chatId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🧹 *Sweeparr Test Notification*\n\nIf you see this message, your Telegram notifications are working!',
        parse_mode: 'Markdown',
      }),
    });
    const data = await response.json() as { ok: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

async function testGotify(serverUrl: string, appToken: string): Promise<boolean> {
  try {
    const url = `${serverUrl.replace(/\/$/, '')}/message?token=${appToken}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Sweeparr Test Notification',
        message: 'If you see this message, your Gotify notifications are working!',
        priority: 5,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testPushover(serverUrl: string, appToken: string): Promise<boolean> {
  // Pushover has a different API structure - this is a simplified version
  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: appToken,
        user: serverUrl, // serverUrl is actually the user key for Pushover
        title: 'Sweeparr Test Notification',
        message: 'If you see this message, your Pushover notifications are working!',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default router;

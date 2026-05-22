import express from 'express';
import cors from 'cors';
import Locator from './infrastructure/config/Locator';
import MemoryV1 from './interface/routes/MemoryV1';
import logger from './infrastructure/logger';

const app = express();
const PORT = process.env.PORT || 9089;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize locator and routes
const initApp = async () => {
  try {
    // Initialize all dependencies
    await Locator.init();
    
    // Routes
    app.use('/v1', MemoryV1(Locator));
    
    // Health check
    app.get('/v1/health', async (req, res) => {
      try {
        const connection = Locator.get('FalkorDBConnection');
        const isConnected = await connection.isConnected();
        
        res.json({
          status: isConnected ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            falkordb: isConnected ? 'connected' : 'disconnected'
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });
    
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
    
    // Error handler
    app.use((err, req, res, next) => {
      logger.error({ err }, 'Unhandled error');
      res.status(500).json({ error: 'Internal server error' });
    });
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Allan Memory service started');
      logger.info(`Health check: http://localhost:${PORT}/v1/health`);
    });
    
    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await Locator.shutdown();
          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, 'Error during shutdown');
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize application');
    process.exit(1);
  }
};

initApp();

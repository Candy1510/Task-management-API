import express, { Application } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import { requestLogger, errorHandler } from './middleware/logging';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);

  app.use(errorHandler);

  return app;
}

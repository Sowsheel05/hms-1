import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import roomRoutes from './routes/room.routes';
import messRoutes from './routes/mess.routes';
import outingRoutes from './routes/outing.routes';
import complaintRoutes from './routes/complaint.routes';
import leaveRoutes from './routes/leave.routes';
import notificationRoutes from './routes/notification.routes';
import biometricRoutes, { testBiometricRouter } from './routes/biometric.routes';
import managementRoutes from './routes/management.routes';
import hostelApplicationRoutes from './routes/hostel-application.routes';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Simple cookie parser middleware for httpOnly auth cookies
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }
  (req as any).cookies = cookies;
  next();
});

// Safe request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'HMS Student Hostel Backend API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', dashboardRoutes);
app.use('/api/student', roomRoutes);
app.use('/api/student', messRoutes);
app.use('/api/student', outingRoutes);
app.use('/api/student', complaintRoutes);
app.use('/api/student', leaveRoutes);
app.use('/api/student', notificationRoutes);
app.use('/api/student', biometricRoutes);
app.use('/api/student/hostel-application', hostelApplicationRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/test', testBiometricRouter);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
  });
});

const server = app.listen(config.port, () => {
  console.log(`HMS Backend Server running on port ${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
});

export { app, server };

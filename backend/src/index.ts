import express, { type Request, type Response } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createClient, type RedisClientType } from 'redis';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import { setupSocket } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

function health(_req: Request, res: Response) {
  res.status(200).json({ status: 'ok', service: 'SyncFlow' });
}

// `/api/health` is the probe in render.yaml. `/` covers a health check pointed at the root.
app.get('/', health);
app.get('/api/health', health);

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error', err);
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error', err));
} else {
  console.warn('MONGODB_URI is not set');
}

let redisClient: RedisClientType | null = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis error', err));
    redisClient.connect()
      .then(() => console.log('Connected to Redis'))
      .catch((err) => console.error('Redis connection error', err));
  } catch (err) {
    console.error('Redis client setup failed', err);
    redisClient = null;
  }
} else {
  console.warn('REDIS_URL is not set; document state stays in memory until restart');
}

const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

setupSocket(io, redisClient);

const port = Number(process.env.PORT) || 5000;
const host = '0.0.0.0';
// Render's proxy holds idle connections longer than Node's 5s default.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;
server.listen(port, host, () => {
  console.log(`SyncFlow API listening on ${host}:${port}`);
});

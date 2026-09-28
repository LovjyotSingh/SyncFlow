import express from 'express';
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SyncFlow' });
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error', err));
} else {
  console.warn('MONGODB_URI is not set');
}

const redisClient: RedisClientType | null = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => console.error('Redis error', err));
  redisClient.connect()
    .then(() => console.log('Connected to Redis'))
    .catch((err) => console.error('Redis connection error', err));
} else {
  console.warn('REDIS_URL is not set; document state stays in memory until restart');
}

const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSocket(io, redisClient);

const port = Number(process.env.PORT) || 5000;
server.listen(port, () => {
  console.log(`SyncFlow API listening on ${port}`);
});

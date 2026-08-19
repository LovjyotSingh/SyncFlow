import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocket } from './socket/index';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import aiRoutes from './routes/ai';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Enable CORS — accept localhost in dev, production URL in prod
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null,
].filter(Boolean) as string[];

app.use(cors({
  origin: true, // dynamically reflect the request origin (solves all CORS issues)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🍃 Connected to MongoDB Atlas'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('⚠️ MONGODB_URI not found in .env');
}

// Connect to Upstash Redis
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('⚡ Connected to Upstash Redis'));

if (process.env.REDIS_URL) {
  redisClient.connect();
} else {
  console.warn('⚠️ REDIS_URL not found in .env');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api', aiRoutes);
app.use('/api/ai', aiRoutes);

// Initialize Socket.io for real-time syncing
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSocket(io, redisClient);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SyncFlow Real-time API' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

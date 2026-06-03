const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// Redis client setup
let redisClient;
async function connectRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
}
connectRedis();

// Express Middleware
app.use(cors());
app.use(express.json());

// Attach services to request context
app.use((req, res, next) => {
  req.prisma = prisma;
  req.redis = redisClient;
  req.io = io;
  next();
});

// REST API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Socket.io Real-time Operations
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a Project room
  socket.on('join_project', async ({ projectId, userId, username }) => {
    socket.join(`project:${projectId}`);
    socket.projectId = projectId;
    socket.userId = userId;
    socket.username = username;

    console.log(`User ${username} (${userId}) joined project room: ${projectId}`);

    // Update Presence in Redis
    if (redisClient && redisClient.isOpen) {
      const presenceKey = `project:${projectId}:presence`;
      await redisClient.hSet(presenceKey, userId.toString(), JSON.stringify({
        socketId: socket.id,
        username,
        joinedAt: new Date().toISOString()
      }));

      // Broadcast updated active user list
      const activeUsers = await redisClient.hGetAll(presenceKey);
      const userList = Object.entries(activeUsers).map(([id, info]) => {
        return { id: parseInt(id), ...JSON.parse(info) };
      });
      io.to(`project:${projectId}`).emit('presence_update', userList);
    }
  });

  // Chat message send
  socket.on('send_message', async ({ projectId, userId, username, content }) => {
    try {
      const message = await prisma.chatMessage.create({
        data: {
          content,
          projectId: parseInt(projectId),
          userId: parseInt(userId),
        },
        include: {
          user: {
            select: { name: true }
          }
        }
      });

      // Broadcast chat message to project room
      io.to(`project:${projectId}`).emit('new_message', {
        id: message.id,
        content: message.content,
        userId: message.userId,
        username: message.user.name,
        createdAt: message.createdAt,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove from presence tracking in Redis
    if (socket.projectId && socket.userId && redisClient && redisClient.isOpen) {
      const presenceKey = `project:${socket.projectId}:presence`;
      await redisClient.hDel(presenceKey, socket.userId.toString());

      // Broadcast updated active user list
      const activeUsers = await redisClient.hGetAll(presenceKey);
      const userList = Object.entries(activeUsers).map(([id, info]) => {
        return { id: parseInt(id), ...JSON.parse(info) };
      });
      io.to(`project:${socket.projectId}`).emit('presence_update', userList);
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server-1 (Express/Socket.io) running on port ${PORT}`);
});

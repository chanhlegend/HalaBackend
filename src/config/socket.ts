import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface UserSocket extends Socket {
  userId?: string;
}

class SocketService {
  private io: Server | null = null;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  initialize(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.io.use((socket: UserSocket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        console.log('❌ No token provided');
        return next(new Error('Authentication error'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
        socket.userId = decoded.userId;
        console.log('✅ Token verified for user:', decoded.userId);
        next();
      } catch (error) {
        console.error('❌ Token verification failed:', error);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket: UserSocket) => {
      console.log(`User connected: ${socket.userId}`);
      
      if (socket.userId) {
        this.userSockets.set(socket.userId, socket.id);
      }

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        if (socket.userId) {
          this.userSockets.delete(socket.userId);
        }
      });
    });

    console.log('Socket.IO initialized');
  }

  getIO(): Server {
    if (!this.io) {
      throw new Error('Socket.IO not initialized');
    }
    return this.io;
  }

  // Emit notification to a specific user
  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Emit to multiple users
  emitToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach(userId => this.emitToUser(userId, event, data));
  }

  // Get online status of a user
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Get all online users
  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}

export default new SocketService();

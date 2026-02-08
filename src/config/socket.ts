import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface UserSocket extends Socket {
  userId?: string;
}

interface ActiveCall {
  callerId: string;
  receiverId: string;
  channelName: string;
  startedAt: number;
}

class SocketService {
  private io: Server | null = null;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private activeCalls: Map<string, ActiveCall> = new Map(); // channelName -> ActiveCall

  initialize(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: 10000,   // Ping every 10s to detect dead connections faster
      pingTimeout: 5000,     // Wait 5s for pong before considering disconnected
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

      // Listen for call_ended event from client (e.g. before page unload)
      socket.on('call_ended_by_user', (data: { otherId: string }) => {
        if (socket.userId && data.otherId) {
          console.log(`📴 User ${socket.userId} ended call with ${data.otherId} via socket`);
          this.emitToUser(data.otherId, 'call_ended', { userId: socket.userId });
          this.removeCallByUserId(socket.userId);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.userId}, reason: ${reason}`);
        if (socket.userId) {
          // Notify the other party if this user was in an active call
          this.handleUserDisconnectDuringCall(socket.userId);
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

  // ===== Active Call Tracking =====

  // Register an active call between two users
  registerCall(callerId: string, receiverId: string, channelName: string) {
    this.activeCalls.set(channelName, {
      callerId,
      receiverId,
      channelName,
      startedAt: Date.now(),
    });
    console.log(`📞 Call registered: ${callerId} <-> ${receiverId} on ${channelName}`);
  }

  // Remove a call by channel name
  removeCall(channelName: string) {
    const removed = this.activeCalls.delete(channelName);
    if (removed) {
      console.log(`📴 Call removed: ${channelName}`);
    }
  }

  // Remove call by user ID (find any call involving this user)
  removeCallByUserId(userId: string) {
    for (const [channelName, call] of this.activeCalls.entries()) {
      if (call.callerId === userId || call.receiverId === userId) {
        this.activeCalls.delete(channelName);
        console.log(`📴 Call removed for user ${userId}: ${channelName}`);
        return call;
      }
    }
    return null;
  }

  // Get the other party's userId in a call
  getCallPartner(userId: string): string | null {
    for (const call of this.activeCalls.values()) {
      if (call.callerId === userId) return call.receiverId;
      if (call.receiverId === userId) return call.callerId;
    }
    return null;
  }

  // Handle user disconnect during an active call
  private handleUserDisconnectDuringCall(userId: string) {
    const call = this.removeCallByUserId(userId);
    if (call) {
      const otherId = call.callerId === userId ? call.receiverId : call.callerId;
      console.log(`📴 User ${userId} disconnected during call, notifying ${otherId}`);
      this.emitToUser(otherId, 'call_ended', {
        userId,
        reason: 'user_disconnected',
      });
    }
  }
}

export default new SocketService();

import { Express } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import friendRoutes from './friendRoutes';
import notificationRoutes from './notificationRoutes';
import messageRoutes from './messageRoutes';
import callRoutes from './callRoutes';
import postRoutes from './postRoutes';
import commentRoutes from './commentRoutes';

function route(app: Express) {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/friends', friendRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/calls', callRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/comments', commentRoutes);
}

export default route;

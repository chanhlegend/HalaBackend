import { Express } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import friendRoutes from './friendRoutes';
import notificationRoutes from './notificationRoutes';

function route(app: Express) {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/friends', friendRoutes);
    app.use('/api/notifications', notificationRoutes);
}

export default route;

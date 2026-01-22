import { Express } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';

function route(app: Express) {
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
}

export default route;

import express from 'express';
import { json } from 'body-parser';
import { router as planRoutes } from './routes/planRoutes';
import { router as chatRoutes } from './routes/chatRoutes';
import { router as unitRoutes } from './routes/unitRoutes';

const app = express();

// Middleware
app.use(json());

// Routes
app.use('/api/plans', planRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/units', unitRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

export default app;
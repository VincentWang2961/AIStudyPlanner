import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import routes from './routes/index';
import errorHandler from './middlewares/errorHandler';

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling middleware
app.use(errorHandler);

export default app;
import express, { Express } from 'express';
import config from './config/config';
import { connectToDatabase } from './config/database';
import authRouter from './routes/auth_routes';

const app: Express = express();
const port = config.port;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);

// Connect to database
connectToDatabase();

// Start server
app.listen(port, async () => {
  console.log(`⚡️Server is running on port: ${port}`);
});
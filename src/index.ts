import express, { Express } from 'express';
import config from './config/config';
import { connectToDatabase } from './config/database';
import authRouter from './routes/auth_routes';
import userRouter from './routes/user_routes';
import morgan from 'morgan';

const app: Express = express();
const port = config.port;

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);


// Connect to database
connectToDatabase();

// Start server
app.listen(port, async () => {
  console.log(`⚡️Server is running on port: ${port}`);
});
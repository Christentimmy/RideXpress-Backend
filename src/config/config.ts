import dotenv from 'dotenv';

dotenv.config({ debug: false })

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
};

export default config;

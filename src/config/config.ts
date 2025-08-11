import dotenv from 'dotenv';

dotenv.config({ debug: false })

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN!,
  },
  redis: {
    password: process.env.REDIS_PASSWORD!,
    port: process.env.REDIS_PORT!,
    url: process.env.REDIS_URL!,
    username: process.env.REDIS_USERNAME!,
  }
};

export default config;

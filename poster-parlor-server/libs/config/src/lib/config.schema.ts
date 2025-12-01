import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'staging')
    .default('development'),
  PORT: Joi.number().default(4000),
  DB_NAME: Joi.string(),
  DATABASE_URL: Joi.string(),
  FRONTEND_URL: Joi.string(),
  GOOGLE_CLIENT_SECRET: Joi.string(),
  GOOGLE_CALLBACK_URL: Joi.string(),
  GOOGLE_CLIENT_ID: Joi.string(),
  JWT_REFRESH_TOKEN_EXPIRATION: Joi.string(),
  JWT_REFRESH_TOKEN_SECRET: Joi.string(),
  JWT_ACCESS_TOKEN_EXPIRATION: Joi.string(),
  JWT_ACCESS_TOKEN_SECRET: Joi.string(),
  CLOUDINARY_CLOUD_NAME: Joi.string(),
  CLOUDINARY_API_KEY: Joi.string(),
  CLOUDINARY_API_SECRET: Joi.string(),
  RAZORPAY_API_KEY: Joi.string(),
  RAZORPAY_API_SECRET: Joi.string(),
});

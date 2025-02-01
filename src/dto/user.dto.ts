/**
 * @file user.dto.ts
 * @description Data Transfer Objects for user-related data validation.
 */

import Joi from "joi";

export const registerSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required(),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must contain at least 8 characters",
    "string.empty": "Password cannot be empty",
    "any.required": "Password is required",
  }),
  hcaptchaResponse: Joi.string().required(),
});

export const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

export const changeUsernameSchema = Joi.object({
  newUsername: Joi.string()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/)
    .required(),
});

export const listenSongSchema = Joi.object({
  songTitle: Joi.string().required(),
  songFile: Joi.string().required(),
  albumId: Joi.string().required(),
});

export const listenAlbumSchema = Joi.object({
  albumId: Joi.string().required(),
});

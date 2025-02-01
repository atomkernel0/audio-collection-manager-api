/**
 * @file playlist.dto.ts
 * @description Data Transfer Objects for playlist data validation (Joi schemas).
 */

import Joi from "joi";

export const songSchema = Joi.object({
  _id: Joi.string().optional(),
  title: Joi.string().optional(),
  file: Joi.string().optional(),
  albumTitle: Joi.string().optional(),
  albumArtist: Joi.array().items(Joi.string()).optional(),
  albumCover: Joi.string().optional(),
  albumId: Joi.string().optional(),
  albumLang: Joi.string().optional(),
});

export const playlistSchema = Joi.object({
  name: Joi.string().max(40).required(),
  private: Joi.boolean().required(),
  song: songSchema.required(),
});

export const playlistNameSchema = Joi.object({
  playlistId: Joi.string().required(),
  newName: Joi.string().max(40).required(),
});

export const playlistOrderSchema = Joi.object({
  playlistId: Joi.string().required(),
  newOrder: Joi.array().items(songSchema).required(),
});

export const togglePrivateSchema = Joi.object({
  playlistId: Joi.string().required(),
});

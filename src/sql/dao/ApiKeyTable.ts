/**
 * @file ApiKeyTable.ts
 * @description API Key 数据访问对象，负责处理 API Key 相关的数据库操作
 */

import { Database } from 'sqlite';
import {
  INSERT_API_KEY,
  GET_API_KEYS_BY_USER_ID,
  GET_API_KEY_BY_ID,
  GET_API_KEY_BY_HASH,
  UPDATE_API_KEY,
  DELETE_API_KEY_BY_ID,
} from './apiKeys.sql';

/**
 * @class ApiKeyTable
 * @description API Key 数据访问对象类，提供 API Key 的增删改查操作
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class ApiKeyTable {
  /**
   * @constructor
   * @param {Database} db - SQLite 数据库实例
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private db: Database,
  ) {}

  async createApiKey(apiKey: {
    id: string;
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    type: string;
  }) {
    await this.db.run(INSERT_API_KEY, {
      id: apiKey.id,
      user_id: apiKey.user_id,
      name: apiKey.name,
      key_hash: apiKey.key_hash,
      key_prefix: apiKey.key_prefix,
      type: apiKey.type,
    });
  }

  async getApiKeysByUserId(userId: string) {
    return await this.db.all(GET_API_KEYS_BY_USER_ID, { user_id: userId });
  }

  async getApiKeyById(id: string) {
    return await this.db.get(GET_API_KEY_BY_ID, { id });
  }

  async getApiKeyByHash(keyHash: string) {
    return await this.db.get(GET_API_KEY_BY_HASH, { key_hash: keyHash });
  }

  async updateApiKey(
    id: string,
    userId: string,
    updateData: { name?: string; key?: string; type?: string },
  ) {
    await this.db.run(UPDATE_API_KEY, {
      name: updateData.name,
      key_hash: updateData.key,
      key_prefix: updateData.key ? updateData.key.substring(0, 5) : undefined,
      type: updateData.type,
      id,
      user_id: userId,
    });
  }

  async deleteApiKey(id: string, userId: string) {
    await this.db.run(DELETE_API_KEY_BY_ID, { id, user_id: userId });
  }
}

import { Database } from 'sqlite';
import {
  INSERT_API_KEY,
  GET_API_KEYS_BY_USER_ID,
  GET_API_KEY_BY_ID,
  GET_API_KEY_BY_HASH,
  UPDATE_API_KEY,
  DELETE_API_KEY_BY_ID,
} from '../sql/dao/apiKeys.sql';

export class ApiKeyTable {
  constructor(private db: Database) {}

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

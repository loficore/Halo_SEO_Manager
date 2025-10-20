import { Database } from 'sqlite';
import {
  INSERT_OR_REPLACE_SETTING,
  GET_SETTING_BY_KEY,
  GET_ALL_SETTINGS,
} from '../sql/dao/settings.sql';

export class SettingsTable {
  constructor(private db: Database) {}

  async upsertSetting(key: string, value: string) {
    await this.db.run(INSERT_OR_REPLACE_SETTING, { key, value });
  }

  async getSetting(key: string) {
    return await this.db.get(GET_SETTING_BY_KEY, { key });
  }

  async getAllSettings() {
    return await this.db.all(GET_ALL_SETTINGS);
  }
}

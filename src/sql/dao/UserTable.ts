import { Database } from 'sqlite';
import {
  INSERT_USER,
  GET_USER_BY_USERNAME,
  GET_USER_BY_ID,
  UPDATE_USER_MFA_SECRET,
  UPDATE_USER_ROLE,
  GET_ALL_USERS,
  DELETE_USER_BY_ID,
} from '../sql/dao/users.sql';

export class UserTable {
  constructor(private db: Database) {}

  async createUser(user: {
    id: string;
    username: string;
    email: string;
    password_hash: string;
    mfa_secret: string;
    role: string;
  }) {
    await this.db.run(INSERT_USER, {
      id: user.id,
      username: user.username,
      email: user.email,
      password_hash: user.password_hash,
      mfa_secret: user.mfa_secret,
      role: user.role,
    });
  }

  async getUserByUsername(username: string) {
    return await this.db.get(GET_USER_BY_USERNAME, { username });
  }

  async getUserById(id: string) {
    return await this.db.get(GET_USER_BY_ID, { id });
  }

  async updateUserMfaSecret(id: string, mfaSecret: string) {
    await this.db.run(UPDATE_USER_MFA_SECRET, { mfa_secret: mfaSecret, id });
  }

  async updateUserRole(id: string, role: string) {
    await this.db.run(UPDATE_USER_ROLE, { role, id });
  }

  async getAllUsers() {
    return await this.db.all(GET_ALL_USERS);
  }

  async deleteUser(id: string) {
    await this.db.run(DELETE_USER_BY_ID, { id });
  }
}

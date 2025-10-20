// This is a placeholder for MelodyAuthClient.
// In a real application, this would contain the client logic for interacting with the MelodyAuth service.
import axios from 'axios';

interface AuthenticateRequest {
  username: string;
  password?: string;
  mfa_token?: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface JwtPayload {
  userId: string;
  role: string; // Assuming role is a string in the payload
  exp?: number;
  iat?: number;
}

export class MelodyAuthClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async authenticate(request: AuthenticateRequest): Promise<AuthResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/authenticate`,
        request,
      );
      return response.data;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * @description 验证 JWT token 并返回其负载。
   * @description English: Verifies a JWT token and returns its payload.
   * @param {string} token - JWT token。
   * @returns {Promise<JwtPayload | null>} JWT 负载对象，如果无效则为 null。
   */
  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      // TODO: 这里需要集成实际的 JWT 验证库 (例如 jsonwebtoken)
      // For now, let's assume the token is a Base64 encoded JSON string that contains the payload.
      // In a real application, you would use a JWT library (e.g., 'jsonwebtoken')
      // and potentially communicate with MelodyAuth to verify the token's signature and expiration.

      // Decode the token (very simplified, real JWTs have three parts)
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const payload: JwtPayload = JSON.parse(decoded);

      // Basic expiration check (real JWT verification includes signature check)
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error: any) {
      // Log the error but don't rethrow, so authMiddleware can handle it gracefully
      // This allows distinguishing between invalid token and service error
      console.error('Error verifying token:', error.message);
      return null;
    }
  }

  async registerUser(request: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/register`, request);
      return response.data;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

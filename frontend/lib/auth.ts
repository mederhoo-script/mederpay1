import apiClient from './api';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export const auth = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login/', {
      email,
      password,
    });
    localStorage.setItem('access_token', data.tokens.access);
    localStorage.setItem('refresh_token', data.tokens.refresh);
    return data;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    business_name: string;
    business_address: string;
  }): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/register/', userData);
    localStorage.setItem('access_token', data.tokens.access);
    localStorage.setItem('refresh_token', data.tokens.refresh);
    return data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export default auth;

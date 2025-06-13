import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type UserWithRoles } from '@shared/schema'; // Assuming UserWithRoles is the type for a logged-in user with their roles

interface AuthContextType {
  currentUser: UserWithRoles | null;
  isLoading: boolean;
  login: (employeeCode: string, pin?: string) => Promise<UserWithRoles>;
  logout: () => Promise<void>;
  switchUser: (employeeCode: string, pin?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserWithRoles | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true to check session

  useEffect(() => {
    // Check for existing session on initial load
    const checkSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = async (employeeCode: string, pin?: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeCode, pin }),
    });
    if (response.ok) {
      const data = await response.json();
      setCurrentUser(data.user);
      return data.user;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    // Optionally redirect to login page or handle elsewhere
  };

  const switchUser = async (employeeCode: string, pin?: string) => {
    const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode, pin }),
    });
    if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
    } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'User switch failed');
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
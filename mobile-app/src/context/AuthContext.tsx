import React, { createContext, useContext, useEffect, useState } from 'react';

const memoryStorage: Record<string, string> = {};
const storage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (typeof globalThis.localStorage !== 'undefined') {
      return globalThis.localStorage.getItem(key);
    }
    return memoryStorage[key] ?? null;
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    memoryStorage[key] = value;
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(key);
      return;
    }
    delete memoryStorage[key];
  },
};

export interface UserProfile {
  fullName: string;
  email: string;
  mobile: string;
  residentType: 'OWNER' | 'TENANT';
  flatNumber?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isRegisteredUser: (mobile: string) => boolean;
  login: (mobile: string) => Promise<boolean>;
  register: (profile: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const USERS_KEY = 'tbits_plug_users';
const CURRENT_USER_KEY = 'tbits_plug_current_user';

// Seeded dummy user for testing
const DEFAULT_USERS: Record<string, UserProfile> = {
  '8305763637': {
    fullName: 'Nitish (Resident)',
    email: 'resident@apartment.com',
    mobile: '8305763637',
    residentType: 'OWNER',
    flatNumber: 'Tower A - 402',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<Record<string, UserProfile>>(DEFAULT_USERS);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const savedUsers = await storage.getItemAsync(USERS_KEY);
        const savedCurrentUser = await storage.getItemAsync(CURRENT_USER_KEY);

        if (savedUsers) {
          setUsers({ ...DEFAULT_USERS, ...JSON.parse(savedUsers) });
        }

        if (savedCurrentUser) {
          setUser(JSON.parse(savedCurrentUser));
        }
      } catch (error) {
        console.error('Failed to load auth data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, []);

  const isRegisteredUser = (mobile: string): boolean => {
    const cleanNumber = mobile.trim();
    return Boolean(users[cleanNumber]);
  };

  const login = async (mobile: string): Promise<boolean> => {
    const cleanNumber = mobile.trim();
    const existingUser = users[cleanNumber];

    if (!existingUser) {
      return false;
    }

    setUser(existingUser);
    await storage.setItemAsync(CURRENT_USER_KEY, JSON.stringify(existingUser));
    return true;
  };

  const register = async (profile: UserProfile): Promise<void> => {
    const cleanNumber = profile.mobile.trim();
    const updatedUsers = {
      ...users,
      [cleanNumber]: profile,
    };

    setUsers(updatedUsers);
    setUser(profile);

    await storage.setItemAsync(USERS_KEY, JSON.stringify(updatedUsers));
    await storage.setItemAsync(CURRENT_USER_KEY, JSON.stringify(profile));
  };

  const logout = async () => {
    setUser(null);
    await storage.deleteItemAsync(CURRENT_USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isRegisteredUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
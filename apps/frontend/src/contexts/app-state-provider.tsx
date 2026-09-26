import { createContext, useMemo, useState } from 'react';
import { TokenResponse } from '@repo/shared';
import { STORAGE_KEY } from '@/constants';
import { clearSession } from '@/api/service';

export type CurrentUser = TokenResponse['user'];

export type AppStateData = {
  isAuthenticated: boolean;
  currentUser: CurrentUser | null;
};

export type AppState = {
  state: AppStateData;
  signIn: (tokens: TokenResponse) => void;
  signOut: () => void;
};

function readCurrentUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY.CURRENT_USER);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

// a stored refresh token means a session exists; the axios interceptor renews the access token on the first 401
const initialAppState = (): AppStateData => ({
  isAuthenticated: !!localStorage.getItem(STORAGE_KEY.REFRESH_TOKEN),
  currentUser: readCurrentUser(),
});

export const AppStateProviderContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppStateData>(initialAppState);

  const value = useMemo<AppState>(
    () => ({
      state: data,
      signIn: ({ accessToken, refreshToken, user }) => {
        localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEY.REFRESH_TOKEN, refreshToken);
        localStorage.setItem(STORAGE_KEY.CURRENT_USER, JSON.stringify(user));
        setData({ isAuthenticated: true, currentUser: user });
      },
      signOut: () => {
        clearSession();
        setData({ isAuthenticated: false, currentUser: null });
      },
    }),
    [data],
  );

  return <AppStateProviderContext.Provider value={value}>{children}</AppStateProviderContext.Provider>;
}

import { AppStateProviderContext } from '@/contexts/app-state-provider';
import { useContext } from 'react';

export const useAppState = () => {
  const value = useContext(AppStateProviderContext);

  if (value === undefined) {
    throw new Error('useAppState must be used within a AppStateProviderContext');
  }

  return value;
};

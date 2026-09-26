import { useCallback } from 'react';
import { toast } from 'sonner';
import { ERROR_CODE_TEXT_MAP } from '@repo/shared';

export default function useToastError() {
  // known business codes get their friendly text; anything else falls back to the server message
  const toastError = useCallback((error: { code: string; message?: string }) => {
    toast.error(ERROR_CODE_TEXT_MAP[error.code as keyof typeof ERROR_CODE_TEXT_MAP] || error.message || error.code, {
      duration: 5000,
    });
  }, []);

  return {
    toastError,
  };
}

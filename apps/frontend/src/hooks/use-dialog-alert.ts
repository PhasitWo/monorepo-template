import { DialogAlertData, DialogAlertProviderContext } from '@/contexts/dialog-alert-provider';
import { useCallback, useContext } from 'react';

export const useDialogAlert = () => {
  const context = useContext(DialogAlertProviderContext);

  if (context === undefined) {
    throw new Error('useDialogAlert must be used within a DialogAlertProvider');
  }

  const openDialog = useCallback(
    (options: DialogAlertData) => {
      context.setOpen(true);
      context.setData(options);
    },
    [context],
  );

  const closeDialog = useCallback(() => {
    context.setOpen(false);
  }, [context]);

  const openErrorDialog = useCallback(
    (error: { code: string; message: string }) => {
      context.setOpen(true);
      context.setData({ title: error.code, mode: 'error', description: error.message });
    },
    [context],
  );

  return {
    openDialog,
    closeDialog,
    openErrorDialog,
  };
};

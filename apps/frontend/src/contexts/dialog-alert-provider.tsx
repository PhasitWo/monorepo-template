import { createContext, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export type DialogAlertData = {
  mode?: 'info' | 'warning' | 'error';
  title: string;
  description?: string;
  actionText?: string;
  cancelText?: string;
  onAction?: () => void;
  onCancel?: () => void;
};

type DialogAlertProviderState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  data: DialogAlertData;
  setData: (data: DialogAlertData) => void;
};

export const DialogAlertProviderContext = createContext<DialogAlertProviderState | undefined>(undefined);

export function DialogAlertProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DialogAlertData>({
    mode: 'info',
    title: 'Alert!',
    description: undefined,
    actionText: undefined,
    cancelText: undefined,
    onAction: undefined,
    onCancel: undefined,
  });

  const value = useMemo(() => ({ open, setOpen, data, setData }), [open, setOpen, data, setData]);

  return (
    <DialogAlertProviderContext.Provider value={value}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{data.title}</AlertDialogTitle>
            <AlertDialogDescription>{data.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {data.mode !== 'info' && (
              <AlertDialogCancel onClick={data.onCancel}>{data.cancelText || 'Cancel'}</AlertDialogCancel>
            )}
            <AlertDialogAction
              variant={data.mode === 'error' || data.mode === 'warning' ? 'destructive' : 'default'}
              onClick={data.onAction}
            >
              {data.actionText || 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {children}
    </DialogAlertProviderContext.Provider>
  );
}

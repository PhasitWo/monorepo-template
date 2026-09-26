import type { ComponentProps } from 'react';
import { Spinner } from './ui/spinner';
import { cn } from '@/lib/utils';

export default function LoadingPage({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('w-screen h-screen flex flex-row gap-2 items-center justify-center', className)} {...props}>
      <Spinner className="size-5 text-primary" />
      <div className="font-light">Loading...</div>
    </div>
  );
}

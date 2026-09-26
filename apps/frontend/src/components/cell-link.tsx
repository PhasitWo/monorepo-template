import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export default function CellLink({ children, ...props }: ComponentProps<'div'>) {
  return (
    <div {...props} className={cn(`font-mono w-fit cursor-pointer underline hover:bg-accent`, props.className)}>
      {children}
    </div>
  );
}

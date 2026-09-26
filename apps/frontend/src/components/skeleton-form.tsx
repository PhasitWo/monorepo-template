import { Skeleton } from '@/components/ui/skeleton';
import type { ComponentProps } from 'react';

export function SkeletonForm(props: ComponentProps<'div'>) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-7" {...props}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

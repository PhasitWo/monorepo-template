import { SkeletonForm } from './skeleton-form';

export default function SkeletonPage() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center gap-10">
      <SkeletonForm />
      <SkeletonForm />
    </div>
  );
}

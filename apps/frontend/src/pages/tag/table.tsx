import { useMemo, type ComponentProps } from 'react';
import CellLink from '@/components/cell-link';
import { DataTable, type ExtendedColumnDef } from '@/components/data-table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { dateTimeFormatter } from '@/lib/utils';

export type TagItem = {
  id: string;
  runningCode: string;
  name: string;
  description: string | null;
  createdAt: string;
  isActive: boolean;
};

export default function TagTable({
  onToggleStatus,
  onViewItem,
  ...props
}: Omit<ComponentProps<typeof DataTable>, 'columns'> & {
  data: TagItem[];
  onToggleStatus?: (item: TagItem, isActive: boolean) => void;
  onViewItem?: (item: TagItem) => void;
}) {
  const columns = useMemo<ExtendedColumnDef<TagItem>[]>(
    () => [
      {
        accessorKey: 'runningCode',
        header: 'Code',
        filter: { type: 'number', field: 'runningId', label: 'Code number' },
        cell: ({ row }) => <CellLink onClick={() => onViewItem?.(row.original)}>{row.original.runningCode}</CellLink>,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        size: 300,
        minSize: 300,
        maxSize: 300,
        filter: { type: 'text', field: 'name', label: 'Name' },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.description ?? '—'}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: () => <div className="text-center">Created</div>,
        cell: ({ row }) => (
          <div className="text-center">{dateTimeFormatter.format(new Date(row.original.createdAt))}</div>
        ),
        filter: { type: 'date', field: 'createdAt', label: 'Created' },
      },
      {
        accessorKey: 'isActive',
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const { id, isActive } = row.original;
          return (
            <div className="flex flex-row items-center justify-center gap-2">
              <Switch
                id={`is-active-${id}`}
                checked={isActive}
                onCheckedChange={(checked) => onToggleStatus?.(row.original, checked)}
              />
              <Label htmlFor={`is-active-${id}`}>{isActive ? 'Active' : 'Inactive'}</Label>
            </div>
          );
        },
        filter: {
          type: 'dropdown',
          field: 'isActive',
          label: 'Status',
          fetchOptions: async () => [
            { label: 'Active', value: true },
            { label: 'Inactive', value: false },
          ],
        },
      },
    ],
    [onToggleStatus, onViewItem],
  );

  return <DataTable className="w-full h-[80%]" columns={columns} {...props} />;
}

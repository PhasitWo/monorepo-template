import { useMemo, type ComponentProps } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { DataTable, type ExtendedColumnDef } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { dateTimeFormatter } from '@/lib/utils';

export type UserItem = {
  id: string;
  username: string;
  name: string;
  createdAt: string;
};

export default function UserTable({
  currentUserId,
  onEditItem,
  onDeleteItem,
  ...props
}: Omit<ComponentProps<typeof DataTable>, 'columns'> & {
  data: UserItem[];
  currentUserId?: string;
  onEditItem?: (item: UserItem) => void;
  onDeleteItem?: (item: UserItem) => void;
}) {
  const columns = useMemo<ExtendedColumnDef<UserItem>[]>(
    () => [
      {
        accessorKey: 'username',
        header: 'Username',
        cell: ({ row }) => <span className="font-mono">{row.original.username}</span>,
      },
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => dateTimeFormatter.format(new Date(row.original.createdAt)),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => onEditItem?.(row.original)}>
              <Pencil />
            </Button>
            {/* you can't delete your own account from here */}
            {row.original.id !== currentUserId && (
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => onDeleteItem?.(row.original)}>
                <Trash2 />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [currentUserId, onDeleteItem, onEditItem],
  );

  return <DataTable className="w-full h-[80%]" columns={columns} {...props} />;
}

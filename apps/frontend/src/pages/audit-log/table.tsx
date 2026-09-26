import { useMemo, type ComponentProps } from 'react';
import { auditActionEnum, auditEntityTypeEnum, type AuditLogResponse } from '@repo/shared';
import { DataTable, type ExtendedColumnDef } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { dateTimeFormatter } from '@/lib/utils';

function formatDiff(diff: AuditLogResponse['diff']): string {
  if (!diff) return '';
  return Object.entries(diff)
    .map(([field, [from, to]]) => `${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`)
    .join(', ');
}

export default function AuditLogTable(
  props: Omit<ComponentProps<typeof DataTable>, 'columns'> & { data: AuditLogResponse[] },
) {
  const columns = useMemo<ExtendedColumnDef<AuditLogResponse>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Time',
        cell: ({ row }) => dateTimeFormatter.format(new Date(row.original.createdAt)),
        filter: { type: 'date', field: 'createdAt', label: 'Time' },
      },
      {
        accessorKey: 'actorUsername',
        header: 'User',
        cell: ({ row }) => row.original.actorUsername ?? '—',
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => <Badge variant="secondary">{row.original.action}</Badge>,
        filter: {
          type: 'dropdown',
          field: 'action',
          label: 'Action',
          fetchOptions: async () => auditActionEnum.options.map((value) => ({ label: value, value })),
        },
      },
      {
        accessorKey: 'entityType',
        header: 'Entity',
        cell: ({ row }) => row.original.entityType ?? '—',
        filter: {
          type: 'dropdown',
          field: 'entityType',
          label: 'Entity',
          fetchOptions: async () => auditEntityTypeEnum.options.map((value) => ({ label: value, value })),
        },
      },
      {
        id: 'changes',
        header: 'Changes',
        size: 400,
        maxSize: 400,
        cell: ({ row }) => {
          const text =
            formatDiff(row.original.diff) || (row.original.metadata ? JSON.stringify(row.original.metadata) : '');
          return (
            <span className="text-muted-foreground font-mono text-xs" title={text}>
              {text || '—'}
            </span>
          );
        },
      },
    ],
    [],
  );

  return <DataTable className="w-full h-[80%]" columns={columns} {...props} />;
}

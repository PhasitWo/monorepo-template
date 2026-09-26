import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from './pagination';
import { cn, dateFormatter } from '@/lib/utils';
import { Button } from './ui/button';
import { Filter, Plus, SearchIcon, X } from 'lucide-react';
import { type FilterOperatorEnum, type filterQuery, type FilterQueryUnit, filterQueryUnitSchema } from '@repo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Field, FieldGroup } from './ui/field';
import { Input } from './ui/input';
import { Calendar } from './ui/calendar';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';

export type Filter = (
  | {
      type: 'text';
    }
  | {
      type: 'number';
    }
  | {
      type: 'date';
    }
  | {
      type: 'dropdown';
      fetchOptions: () => Promise<{ label: string; value: string | number | boolean }[]>;
    }
) & { field: string; label: string };

export type ExtendedColumnDef<T> = ColumnDef<T> & {
  filter?: Filter;
};

export interface Pagination {
  page: number;
  pageSize: number;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  totalRowCount: number;
  pagination?: Pagination;
  onPaginationChange?: (page: number, pageSize: number) => void;
  className?: string;
  filters?: filterQuery;
  onFilterChange?: (filters: filterQuery) => void;
  isTableLoading?: boolean;
  onSearchChange?: (value: string) => void;
  onAddBtnClick?: () => void;
  addBtnLabel?: string;
  headerUsePopoverColor?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  totalRowCount,
  pagination,
  onPaginationChange,
  filters = [],
  onFilterChange,
  isTableLoading,
  className,
  onSearchChange,
  onAddBtnClick,
  addBtnLabel,
  headerUsePopoverColor,
}: DataTableProps<T> & { columns: ExtendedColumnDef<T>[] }) {
  const table = useReactTable({
    pageCount: pagination ? Math.ceil(totalRowCount / pagination.pageSize) : 1,
    rowCount: totalRowCount,
    initialState: {
      columnVisibility: columns.reduce(
        (prev, cur) => {
          if (cur.enableHiding && cur.id) {
            prev[cur.id] = false;
          }
          return prev;
        },
        {} as Record<string, boolean>,
      ),
    },
    state: pagination ? { pagination: { pageIndex: pagination.page - 1, pageSize: pagination.pageSize } } : undefined,
    onPaginationChange: pagination
      ? (updater) => {
          const newState =
            typeof updater === 'function'
              ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.pageSize })
              : updater;
          onPaginationChange?.(newState.pageIndex + 1, newState.pageSize);
        }
      : undefined,
    manualPagination: !!pagination,
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const filterableColumns = useMemo(
    () => columns.filter((col) => 'filter' in col && col.filter) as ExtendedColumnDef<T>[],
    [columns],
  );

  const labelMap = useMemo<Record<string, string>>(
    () =>
      filterableColumns.reduce(
        (acc, col) => {
          const c = col as ExtendedColumnDef<T>;
          if (c.filter) {
            acc[c.filter.field] = c.filter.label;
          }

          return acc;
        },
        {} as Record<string, string>,
      ),
    [filterableColumns],
  );

  const [search, setSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const timer = setTimeout(() => {
      onSearchChange?.(search);
    }, 1000);
    timerRef.current = timer;
  }, [onSearchChange, search]);

  const showTopPanel = filterableColumns.length > 0 || onSearchChange !== undefined || onAddBtnClick !== undefined;

  return (
    <div className={cn('overflow-hidden rounded-md border flex flex-col', className)}>
      {showTopPanel && (
        <div className="pt-2 pb-2 px-2 flex items-center gap-2 flex-wrap">
          {onAddBtnClick !== undefined && (
            <Button variant="outline" onClick={onAddBtnClick}>
              <Plus />
              {addBtnLabel ?? 'Add'}
            </Button>
          )}
          {onSearchChange !== undefined && (
            <InputGroup className="w-50">
              <InputGroupInput
                placeholder="Search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
          )}

          {filterableColumns.length > 0 && (
            <FilterPopover
              showClear={filters.length > 0}
              onClear={() => onFilterChange?.([])}
              onAddFilter={(data) => onFilterChange?.([...filters, data])}
              columns={filterableColumns}
            />
          )}

          <div>
            {filters?.map((f, idx) => (
              <Badge
                key={idx}
                variant={'secondary'}
                className="cursor-pointer"
                onClick={() => onFilterChange?.(filters.filter((_, i) => i !== idx))}
              >
                {`${labelMap[f.f]} ${operatorLabelMap[f.o]} ${f.v1}${f.v2 ? ` and ${f.v2}` : ''}`}
                <X />
              </Badge>
            ))}
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn('z-10 sticky top-0 border-b', headerUsePopoverColor ? 'bg-popover' : 'bg-background')}
            >
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isTableLoading ? (
            <TableRow>
              <TableCell colSpan={100} className="h-24">
                <div className="flex justify-center">
                  <Spinner className="text-primary size-10" />
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.columnDef.size, maxWidth: cell.column.columnDef.maxSize }}
                    className="truncate"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {pagination && <DataTablePagination table={table} />}
    </div>
  );
}

const typeOperatorMap: Record<string, FilterOperatorEnum[]> = {
  text: ['eq', 'neq', 'ct', 'nct', 'sw', 'nsw', 'ew', 'new'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  date: ['eq', 'neq', 'bf', 'af', 'btw', 'nbtw'],
  dropdown: ['eq', 'neq'],
};
const operatorLabelMap: Record<FilterOperatorEnum, string> = {
  eq: 'equals',
  neq: 'not equals',
  ct: 'contains',
  nct: 'does not contain',
  sw: 'starts with',
  nsw: 'does not start with',
  ew: 'ends with',
  new: 'does not end with',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  bf: 'before',
  af: 'after',
  btw: 'between',
  nbtw: 'not between',
};

function FilterPopover({
  columns,
  onAddFilter,
  showClear = false,
  onClear,
}: {
  onAddFilter: (data: FilterQueryUnit) => void;
  columns: { filter?: Filter }[];
  showClear?: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<FilterQueryUnit>({
    resolver: zodResolver(filterQueryUnitSchema),
    defaultValues: {
      f: columns?.[0].filter?.field,
      o: 'eq',
      v1: '',
      v2: null,
    },
    mode: 'onSubmit',
  });
  const [dropdownOptions, setDropdownOptions] = useState<{ label: string; value: string | number | boolean }[]>([]);

  const selectedField = form.watch('f');
  const selectedOperator = form.watch('o');
  const v2 = form.watch('v2');

  const fieldType = useMemo(
    () => columns.find((col) => col.filter?.field === selectedField)?.filter?.type ?? 'text',
    [selectedField, columns],
  );

  const operators = typeOperatorMap[fieldType as keyof typeof typeOperatorMap];
  const isRange = selectedOperator === 'btw' || selectedOperator === 'nbtw';

  function onSubmit(data: FilterQueryUnit) {
    setOpen(false);
    onAddFilter(data);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => {
              form.reset();
              setOpen(true);
            }}
          >
            <Filter />
            Add filter
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-5">
              <Controller
                name="f"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="truncate">
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const col = columns.find((col) => col.filter?.field === value)!;
                        const fieldType = col.filter?.type ?? 'text';
                        const operators = typeOperatorMap[fieldType as keyof typeof typeOperatorMap];
                        form.setValue('o', operators[0]);
                        form.setValue('v1', '');
                        form.setValue('v2', null);
                        if (fieldType === 'dropdown' && col.filter && 'fetchOptions' in col.filter) {
                          const fetchOptions = col.filter?.fetchOptions;
                          if (fetchOptions) {
                            fetchOptions().then((options) => setDropdownOptions(options));
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {columns.map((col, idx) =>
                            col.filter ? (
                              <SelectItem key={idx} value={col.filter.field}>
                                {col.filter.label}
                              </SelectItem>
                            ) : null,
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="o"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="truncate">
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('v1', '');
                        form.setValue('v2', null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          {operators.map((op) => (
                            <SelectItem key={op} value={op}>
                              {operatorLabelMap[op]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                name="v1"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="truncate">
                    {fieldType === 'dropdown' ? (
                      <Select
                        value={typeof field.value === 'string' ? field.value : undefined}
                        onValueChange={(value) => field.onChange(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {dropdownOptions.map((option) => (
                              <SelectItem key={String(option.value)} value={String(option.value)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : fieldType === 'date' ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" id="date-picker-simple" className="justify-start font-normal">
                            {!field.value ? (
                              <span>Pick a date</span>
                            ) : isRange ? (
                              `${dateFormatter.format(new Date(field.value as string))} - ${v2 ? dateFormatter.format(new Date(v2)) : ''}`
                            ) : (
                              dateFormatter.format(new Date(field.value as string))
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          {isRange ? (
                            <Calendar
                              mode={'range'}
                              captionLayout="dropdown"
                              selected={
                                v2 && typeof field.value === 'string'
                                  ? { from: new Date(field.value), to: new Date(v2) }
                                  : undefined
                              }
                              onSelect={(d) => {
                                if (d?.from && d.to) {
                                  field.onChange(d.from.toISOString());
                                  form.setValue('v2', d.to.toISOString());
                                } else {
                                  field.onChange(null);
                                  form.setValue('v2', null);
                                }
                              }}
                            />
                          ) : (
                            <Calendar
                              mode={'single'}
                              captionLayout="dropdown"
                              selected={typeof field.value === 'string' ? new Date(field.value) : undefined}
                              onSelect={(d) => field.onChange(d ? d.toISOString() : null)}
                            />
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        aria-invalid={fieldState.invalid}
                        required
                        value={(field.value as string | undefined) ?? ''}
                        type={fieldType}
                        onChange={(e) => {
                          field.onChange(fieldType === 'number' ? Number(e.target.value) : e.target.value);
                        }}
                      />
                    )}
                  </Field>
                )}
              />
              <Field>
                <Button type="submit">Add</Button>
              </Field>
            </FieldGroup>
          </form>
        </PopoverContent>
      </Popover>
      {showClear && (
        <Button variant="destructive" onClick={() => onClear()}>
          <X />
          Clear
        </Button>
      )}
    </>
  );
}

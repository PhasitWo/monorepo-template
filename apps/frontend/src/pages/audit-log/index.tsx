import { useCallback, useEffect } from 'react';
import { ListAuditLogResponse } from '@repo/shared';
import { AuditLogAPI } from '@/api';
import PageHeader from '@/components/page-header';
import { useFetch } from '@/hooks/use-fetch';
import useToastError from '@/hooks/use-toast-error';
import AuditLogTable from './table';

export default function AuditLog() {
  const {
    pagination,
    setPagination,
    filters,
    setFilters,
    data,
    transformedQuery,
    setData,
    isLoading,
    setIsLoading,
    totalItems,
    setTotalItems,
  } = useFetch<ListAuditLogResponse>();
  const { toastError } = useToastError();

  const fetchLogs = useCallback(() => {
    setIsLoading(true);
    // the audit log has no free-text search; only paging and filters apply
    const { page, pageSize, filters } = transformedQuery;
    AuditLogAPI.listAuditLogs({ page, pageSize, filters })
      .then((resp) => {
        if (!resp.success) {
          toastError(resp.error);
          setData([]);
          return;
        }
        setData(resp.data);
        setTotalItems(resp.meta?.pagination?.total ?? -1);
      })
      .finally(() => setIsLoading(false));
  }, [setIsLoading, transformedQuery, setData, setTotalItems, toastError]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <PageHeader title="Audit log" />
      <AuditLogTable
        isTableLoading={isLoading}
        data={data}
        totalRowCount={totalItems}
        pagination={pagination}
        onPaginationChange={(page, pageSize) => {
          setPagination({ ...pagination, page, pageSize });
        }}
        filters={filters}
        onFilterChange={setFilters}
      />
    </>
  );
}

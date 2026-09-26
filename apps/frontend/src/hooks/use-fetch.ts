import { useMemo, useState, useEffect } from 'react';
import { filterQuery } from '@repo/shared';
import { useSearchParams } from 'react-router';

export type TransformedQuery = {
  page: string;
  pageSize: string;
  filters?: string;
  search?: string;
};

export function useFetch<T extends unknown[]>() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params, falling back to defaults
  const [pagination, setPagination] = useState(() => {
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 10;
    return { page, pageSize };
  });

  const [search, setSearch] = useState<string>(() => {
    return searchParams.get('search') ?? '';
  });

  const [filters, setFilters] = useState<filterQuery>(() => {
    const filtersParam = searchParams.get('filters');
    if (filtersParam) {
      try {
        return JSON.parse(filtersParam);
      } catch (e) {
        console.error('Failed to parse filters from URL', e);
        return [];
      }
    }
    return [];
  });

  const [data, setData] = useState<T>([] as unknown as T);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 })); // reset pagination on search change
  }, [search]);

  //  Sync local state changes back to the URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('page', String(pagination.page));
    params.set('pageSize', String(pagination.pageSize));
    params.set('search', search);

    if (filters && filters.length > 0) {
      params.set('filters', JSON.stringify(filters));
    } else {
      params.delete('filters'); // Keep the URL clean if there are no filters
    }

    // Use { replace: true } so we don't spam the user's browser history
    // every time they click "next page" or type in a filter.
    setSearchParams(params);
  }, [pagination, filters, search, setSearchParams, searchParams]);

  const transformedQuery = useMemo<TransformedQuery>(
    () => ({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
      filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
      search,
    }),
    [pagination, filters, search],
  );

  return {
    pagination,
    setPagination,
    filters,
    setFilters,
    transformedQuery,
    data,
    setData,
    isLoading,
    setIsLoading,
    totalItems,
    setTotalItems,
    search,
    setSearch,
  };
}

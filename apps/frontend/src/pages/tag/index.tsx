import { ComponentProps, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ListTagResponse } from '@repo/shared';
import { TagAPI } from '@/api';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import useToastError from '@/hooks/use-toast-error';
import TagTable, { type TagItem } from './table';
import ManageTagDialog, { type ManageTagMode } from './manage';

export default function Tag() {
  const [selectedTag, setSelectedTag] = useState<TagItem | undefined>(undefined);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [manageMode, setManageMode] = useState<ManageTagMode>('add');
  const [manageIsLoading, setManageIsLoading] = useState(false);

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
    setSearch,
  } = useFetch<ListTagResponse>();
  const { toastError } = useToastError();

  const fetchTags = useCallback(() => {
    setIsLoading(true);
    TagAPI.listTags(transformedQuery)
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
    fetchTags();
  }, [fetchTags]);

  const handleViewItem = (item: TagItem) => {
    setManageMode('view');
    setSelectedTag(item);
    setManageDialogOpen(true);
  };

  const addTag = useCallback<NonNullable<ComponentProps<typeof ManageTagDialog>['onAddItem']>>(
    (body) => {
      setManageIsLoading(true);
      TagAPI.createTag(body)
        .then((resp) => {
          if (!resp.success) {
            toastError(resp.error);
            return;
          }
          setManageDialogOpen(false);
          fetchTags();
        })
        .finally(() => setManageIsLoading(false));
    },
    [fetchTags, toastError],
  );

  const editTag = useCallback<NonNullable<ComponentProps<typeof ManageTagDialog>['onEditItem']>>(
    (body) => {
      if (!selectedTag) {
        return;
      }
      setManageIsLoading(true);
      TagAPI.updateTag(selectedTag.id, body)
        .then((resp) => {
          if (!resp.success) {
            toastError(resp.error);
            return;
          }
          setManageDialogOpen(false);
          fetchTags();
        })
        .finally(() => setManageIsLoading(false));
    },
    [fetchTags, selectedTag, toastError],
  );

  // optimistic toggle, rolled back if the request fails
  const editTagStatus = useCallback(
    (id: string, isActive: boolean) => {
      setData(data.map((d) => (d.id === id ? { ...d, isActive } : d)));
      TagAPI.updateTag(id, { isActive }).then((resp) => {
        if (!resp.success) {
          toastError(resp.error);
          setData(data.map((d) => (d.id === id ? { ...d, isActive: !isActive } : d)));
        }
      });
    },
    [data, setData, toastError],
  );

  return (
    <>
      <ManageTagDialog
        isLoading={manageIsLoading}
        item={selectedTag}
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        mode={manageMode}
        onModeChange={setManageMode}
        onAddItem={addTag}
        onEditItem={editTag}
      />
      <PageHeader title="Tags" />
      <div className="flex gap-2 mb-2">
        <Button
          onClick={() => {
            setManageMode('add');
            setManageDialogOpen(true);
          }}
        >
          <Plus />
          Add tag
        </Button>
      </div>
      <TagTable
        isTableLoading={isLoading}
        data={data}
        totalRowCount={totalItems}
        pagination={pagination}
        onPaginationChange={(page, pageSize) => {
          setPagination({ ...pagination, page, pageSize });
        }}
        onToggleStatus={(item, isActive) => editTagStatus(item.id, isActive)}
        onViewItem={handleViewItem}
        filters={filters}
        onFilterChange={setFilters}
        onSearchChange={setSearch}
      />
    </>
  );
}

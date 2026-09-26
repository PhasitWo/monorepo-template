import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ListUsersResponse } from '@repo/shared';
import { UserAPI } from '@/api';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/hooks/use-app-state';
import { useDialogAlert } from '@/hooks/use-dialog-alert';
import { useFetch } from '@/hooks/use-fetch';
import useToastError from '@/hooks/use-toast-error';
import UserTable, { type UserItem } from './table';
import ManageUserDialog, { type ManageUserMode, type ManageUserValues } from './manage';

export default function User() {
  const [selectedUser, setSelectedUser] = useState<UserItem | undefined>(undefined);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [manageMode, setManageMode] = useState<ManageUserMode>('add');
  const [manageIsLoading, setManageIsLoading] = useState(false);
  const {
    state: { currentUser },
  } = useAppState();
  const { openDialog } = useDialogAlert();

  const {
    pagination,
    setPagination,
    data,
    transformedQuery,
    setData,
    isLoading,
    setIsLoading,
    totalItems,
    setTotalItems,
    setSearch,
  } = useFetch<ListUsersResponse>();
  const { toastError } = useToastError();

  const fetchUsers = useCallback(() => {
    setIsLoading(true);
    UserAPI.listUsers(transformedQuery)
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
    fetchUsers();
  }, [fetchUsers]);

  const saveUser = useCallback(
    (values: ManageUserValues) => {
      setManageIsLoading(true);
      const request =
        manageMode === 'add'
          ? UserAPI.createUser({ name: values.name, username: values.username, password: values.password })
          : UserAPI.updateUser(selectedUser!.id, { name: values.name });
      request
        .then((resp) => {
          if (!resp.success) {
            toastError(resp.error);
            return;
          }
          setManageDialogOpen(false);
          fetchUsers();
        })
        .finally(() => setManageIsLoading(false));
    },
    [fetchUsers, manageMode, selectedUser, toastError],
  );

  const confirmDelete = useCallback(
    (user: UserItem) => {
      openDialog({
        mode: 'warning',
        title: `Delete ${user.username}?`,
        description: 'The user is signed out everywhere and can no longer sign in.',
        actionText: 'Delete',
        onAction: () => {
          UserAPI.deleteUser(user.id).then((resp) => {
            if (!resp.success) {
              toastError(resp.error);
              return;
            }
            toast.success(`${user.username} deleted`);
            fetchUsers();
          });
        },
      });
    },
    [fetchUsers, openDialog, toastError],
  );

  return (
    <>
      <ManageUserDialog
        isLoading={manageIsLoading}
        item={selectedUser}
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        mode={manageMode}
        onSubmit={saveUser}
      />
      <PageHeader title="Users" />
      <div className="flex gap-2 mb-2">
        <Button
          onClick={() => {
            setManageMode('add');
            setSelectedUser(undefined);
            setManageDialogOpen(true);
          }}
        >
          <Plus />
          Add user
        </Button>
      </div>
      <UserTable
        isTableLoading={isLoading}
        data={data}
        totalRowCount={totalItems}
        pagination={pagination}
        onPaginationChange={(page, pageSize) => {
          setPagination({ ...pagination, page, pageSize });
        }}
        currentUserId={currentUser?.id}
        onEditItem={(item) => {
          setManageMode('edit');
          setSelectedUser(item);
          setManageDialogOpen(true);
        }}
        onDeleteItem={confirmDelete}
        onSearchChange={setSearch}
      />
    </>
  );
}

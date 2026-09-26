import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { createUserBodySchema } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { UserItem } from './table';

export type ManageUserMode = 'add' | 'edit';

// username and password are only editable on create, so edit mode validates the name alone
const addSchema = createUserBodySchema;
const editSchema = createUserBodySchema.pick({ name: true }).extend({ username: z.string(), password: z.string() });
export type ManageUserValues = z.infer<typeof addSchema>;

const emptyValues: ManageUserValues = { name: '', username: '', password: '' };

export default function ManageUserDialog({
  item,
  mode,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  item?: UserItem;
  mode: ManageUserMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ManageUserValues) => void;
  isLoading?: boolean;
}) {
  const form = useForm<ManageUserValues>({
    resolver: zodResolver(mode === 'add' ? addSchema : editSchema),
    mode: 'onSubmit',
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(mode === 'edit' && item ? { name: item.name, username: item.username, password: '' } : emptyValues);
  }, [open, item, mode, form]);

  const isAdd = mode === 'add';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add user' : 'Edit user'}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="username"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-username">Username</FieldLabel>
                  <Input
                    {...field}
                    id="user-username"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    readOnly={!isAdd || isLoading}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="user-name">Name</FieldLabel>
                  <Input {...field} id="user-name" aria-invalid={fieldState.invalid} readOnly={isLoading} />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {isAdd && (
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="user-password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="user-password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                      readOnly={isLoading}
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
            <Field>
              {isLoading ? (
                <Button disabled>
                  <Spinner />
                </Button>
              ) : (
                <Button disabled={!form.formState.isDirty} type="submit">
                  Save
                </Button>
              )}
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

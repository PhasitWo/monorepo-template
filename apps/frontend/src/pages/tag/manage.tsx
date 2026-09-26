import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type { TagItem } from './table';

export type ManageTagMode = 'view' | 'add' | 'edit';
const headerLabelMap: Record<ManageTagMode, string> = {
  view: 'Tag',
  add: 'Add tag',
  edit: 'Edit tag',
};

// the form keeps description as a string; empty means "no description"
const itemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(500),
});
type ItemValues = z.infer<typeof itemSchema>;
const initialItemValues: ItemValues = {
  name: '',
  description: '',
};

export default function ManageTagDialog({
  item,
  mode,
  onModeChange,
  open,
  onOpenChange,
  onAddItem,
  onEditItem,
  isLoading,
}: {
  item?: TagItem;
  mode: ManageTagMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: ManageTagMode) => void;
  onAddItem?: (data: { name: string; description: string | null }) => void;
  onEditItem?: (data: { name: string; description: string | null }) => void;
  isLoading?: boolean;
}) {
  const form = useForm<ItemValues>({
    resolver: zodResolver(itemSchema),
    mode: 'onSubmit',
    defaultValues: initialItemValues,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'add') {
      form.reset(initialItemValues);
    } else if (item) {
      form.reset({ name: item.name, description: item.description ?? '' });
    }
  }, [open, item, mode, form]);

  const submit = form.handleSubmit(({ name, description }) => {
    const body = { name, description: description.trim() || null };
    if (mode === 'add') {
      onAddItem?.(body);
    } else {
      onEditItem?.(body);
    }
  });

  const isView = mode === 'view';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          if (isView) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{headerLabelMap[mode]}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={submit}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="tag-name"
                    aria-invalid={fieldState.invalid}
                    readOnly={isView || isLoading}
                    placeholder="e.g. Urgent"
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag-description">Description</FieldLabel>
                  <Textarea
                    {...field}
                    id="tag-description"
                    aria-invalid={fieldState.invalid}
                    readOnly={isView || isLoading}
                  />
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Field>
              {isLoading ? (
                <Button disabled>
                  <Spinner />
                </Button>
              ) : isView ? (
                <Button
                  onClick={() => {
                    onModeChange('edit');
                    form.setFocus('name');
                  }}
                  type="button"
                  variant="secondary"
                >
                  Edit
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

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // For description
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AppRole, type InsertAppRole } from '@shared/schema';

// Schema for the role form
const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')), // e.g., front_of_house_restaurant
});

type RoleFormData = z.infer<typeof roleFormSchema>;

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleToEdit?: AppRole | null;
}

const RoleFormDialog: React.FC<RoleFormDialogProps> = ({ open, onOpenChange, roleToEdit }) => {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
    },
  });

  useEffect(() => {
    if (roleToEdit) {
      reset({
        name: roleToEdit.name,
        description: roleToEdit.description || '',
        category: roleToEdit.category || '',
      });
    } else {
      reset({ name: '', description: '', category: '' });
    }
  }, [roleToEdit, reset, open]);

  const createRoleMutation = useMutation({
    mutationFn: async (data: InsertAppRole) => {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appRoles'] });
      onOpenChange(false);
      // TODO: Add success toast
    },
    onError: (error: Error) => {
      // TODO: Add error toast
      console.error("Create role error:", error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { id: number, payload: Partial<InsertAppRole> }) => {
      const response = await fetch(`/api/roles/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appRoles'] });
      onOpenChange(false);
      // TODO: Add success toast
    },
    onError: (error: Error) => {
      // TODO: Add error toast
      console.error("Update role error:", error.message);
    },
  });

  const onSubmit = (data: RoleFormData) => {
    const payload: InsertAppRole = {
        name: data.name,
        description: data.description || null,
        category: data.category || null,
    };
    if (roleToEdit) {
      updateRoleMutation.mutate({ id: roleToEdit.id, payload });
    } else {
      createRoleMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{roleToEdit ? 'Edit Role' : 'Add New Role'}</DialogTitle>
          <DialogDescription>
            {roleToEdit ? 'Update the details for this role.' : 'Enter the details for the new role.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Role Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" {...register("description")} />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div>
            <Label htmlFor="category">Category (Optional)</Label>
            <Input id="category" {...register("category")} placeholder="e.g., front_of_house_restaurant" />
            {errors.category && <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createRoleMutation.isPending || updateRoleMutation.isPending}>
              {isSubmitting || createRoleMutation.isPending || updateRoleMutation.isPending ? 'Saving...' : (roleToEdit ? 'Save Changes' : 'Create Role')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoleFormDialog;
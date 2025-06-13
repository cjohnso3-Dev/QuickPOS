import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
  DialogTrigger, // To be used by parent component
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type UserWithRoles, type AppRole, type InsertUser } from '@shared/schema';
// For multi-select, a component like 'react-select' or a custom one would be needed.
// For simplicity, using checkboxes for now.
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';

// Schema for the form
// PIN is optional on create, and also optional on update (if not provided, not changed)
// Roles will be an array of role IDs
const userFormSchema = z.object({
  employeeCode: z.string().length(5, "Must be 5 digits").regex(/^\d{5}$/, "Must be 5 digits"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  pin: z.string().length(4, "Must be 4 digits").regex(/^\d{4}$/, "Must be 4 digits").optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  roleIds: z.array(z.number()).optional().default([]),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userToEdit?: UserWithRoles | null; // Pass user data if editing
}

async function fetchRoles(): Promise<AppRole[]> {
  const response = await fetch('/api/roles');
  if (!response.ok) throw new Error('Failed to fetch roles');
  return response.json();
}

const UserFormDialog: React.FC<UserFormDialogProps> = ({ open, onOpenChange, userToEdit }) => {
  const queryClient = useQueryClient();
  const { data: availableRoles, isLoading: isLoadingRoles } = useQuery<AppRole[]>({
    queryKey: ['appRoles'],
    queryFn: fetchRoles,
  });

  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      pin: '',
      isActive: true,
      roleIds: [],
    },
  });

  useEffect(() => {
    if (userToEdit) {
      reset({
        employeeCode: userToEdit.employeeCode,
        firstName: userToEdit.firstName || '',
        lastName: userToEdit.lastName || '',
        email: userToEdit.email || '',
        pin: '', // PIN is not pre-filled for editing for security
        isActive: userToEdit.isActive ?? true, // Provide default if null
        roleIds: userToEdit.roles?.map(role => role.id) || [],
      });
    } else {
      reset({ // Default for new user
        employeeCode: '',
        firstName: '',
        lastName: '',
        email: '',
        pin: '',
        isActive: true,
        roleIds: [],
      });
    }
  }, [userToEdit, reset, open]); // Reset when dialog opens or userToEdit changes

  const createUserMutation = useMutation({
    mutationFn: async (data: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'> & { pin?: string | null, roleIds?: number[] }) => {
      // The API expects pinHash, not pin. The route handler for POST /api/users creates pinHash.
      // The API also expects role assignments to be handled separately or as part of a more complex payload.
      // For now, this matches the simplified API where roles are handled by /api/users/:userId/roles
      const { roleIds, ...userData } = data; // Separate roleIds for now
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      const createdUser = await response.json() as UserWithRoles;
      // After creating user, assign roles if any
      if (roleIds && roleIds.length > 0) {
        for (const roleId of roleIds) {
          await fetch(`/api/users/${createdUser.id}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId }),
          });
          // TODO: Better error handling for role assignment
        }
      }
      return createdUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false); // Close dialog
      // TODO: Add success toast
    },
    onError: (error: Error) => {
      // TODO: Add error toast
      console.error("Create user error:", error.message);
      // Potentially set form error here
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number, payload: Partial<Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>> & { pin?: string | null, roleIds?: number[] }}) => {
      const { roleIds, ...userData } = data.payload;
      const response = await fetch(`/api/users/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData), // API expects pinHash if pin is changing
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }
      const updatedUser = await response.json() as UserWithRoles;
       // Update roles: remove all, then add selected. More robust would be diffing.
      if (roleIds) {
        const currentRoleIds = userToEdit?.roles.map(r => r.id) || [];
        // Remove roles not in new list
        for (const currentRoleId of currentRoleIds) {
            if (!roleIds.includes(currentRoleId)) {
                await fetch(`/api/users/${updatedUser.id}/roles/${currentRoleId}`, { method: 'DELETE' });
            }
        }
        // Add new roles
        for (const roleId of roleIds) {
            if (!currentRoleIds.includes(roleId)) {
                 await fetch(`/api/users/${updatedUser.id}/roles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roleId }),
                });
            }
        }
      }
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false); // Close dialog
      // TODO: Add success toast
    },
    onError: (error: Error) => {
      // TODO: Add error toast
      console.error("Update user error:", error.message);
    },
  });


  const onSubmit = (data: UserFormData) => {
    const payload = {
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null, // Ensure null if empty
        isActive: data.isActive,
        pin: data.pin || null, // Pass null if PIN is empty, so API can remove it if needed
        roleIds: data.roleIds,
    };

    if (userToEdit) {
      updateUserMutation.mutate({ id: userToEdit.id, payload });
    } else {
      createUserMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{userToEdit ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {userToEdit ? 'Update the details for this user.' : 'Enter the details for the new user.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="employeeCode">Employee Code (5 digits)</Label>
            <Input id="employeeCode" {...register("employeeCode")} maxLength={5} disabled={!!userToEdit} />
            {errors.employeeCode && <p className="text-sm text-red-500 mt-1">{errors.employeeCode.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email (Optional)</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="pin">PIN (Optional, 4 digits)</Label>
            <Input id="pin" type="password" {...register("pin")} maxLength={4} placeholder={userToEdit ? "Enter new PIN to change" : ""} />
            {errors.pin && <p className="text-sm text-red-500 mt-1">{errors.pin.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>Roles</Label>
            {isLoadingRoles ? <p>Loading roles...</p> : (
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-1">
                {availableRoles?.map(role => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Controller
                        name="roleIds"
                        control={control}
                        render={({ field }) => (
                            <Checkbox
                                id={`role-${role.id}`}
                                checked={field.value?.includes(role.id)}
                                onCheckedChange={(checked) => {
                                    const currentRoleIds = field.value || [];
                                    if (checked) {
                                        field.onChange([...currentRoleIds, role.id]);
                                    } else {
                                        field.onChange(currentRoleIds.filter(id => id !== role.id));
                                    }
                                }}
                            />
                        )}
                    />
                    <Label htmlFor={`role-${role.id}`} className="font-normal">{role.name}</Label>
                  </div>
                ))}
                </div>
              </ScrollArea>
            )}
             {errors.roleIds && <p className="text-sm text-red-500 mt-1">{errors.roleIds.message}</p>}
          </div>


          <div className="flex items-center space-x-2">
            <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                    <Switch
                        id="isActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                )}
            />
            <Label htmlFor="isActive">User Active</Label>
          </div>
          {errors.isActive && <p className="text-sm text-red-500 mt-1">{errors.isActive.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createUserMutation.isPending || updateUserMutation.isPending}>
              {isSubmitting || createUserMutation.isPending || updateUserMutation.isPending ? 'Saving...' : (userToEdit ? 'Save Changes' : 'Create User')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserFormDialog;
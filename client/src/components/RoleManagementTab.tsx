import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AppRole, type InsertAppRole } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import RoleFormDialog from './RoleFormDialog'; // Import the dialog

async function fetchAppRoles(): Promise<AppRole[]> {
  const response = await fetch('/api/roles');
  if (!response.ok) {
    throw new Error('Failed to fetch roles');
  }
  return response.json();
}

async function deleteAppRoleApi(roleId: number): Promise<void> {
  const response = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete role');
  }
}

const RoleManagementTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AppRole | null>(null);

  const { data: roles, isLoading, error } = useQuery<AppRole[], Error>({
    queryKey: ['appRoles'], // Use a distinct queryKey from 'users'
    queryFn: fetchAppRoles,
  });

  const deleteRoleMutation = useMutation({
    mutationFn: deleteAppRoleApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appRoles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] }); // Invalidate users too as their roles might change display
      // TODO: Add toast notification for success
      alert('Role deleted successfully!');
    },
    onError: (err: Error) => {
      // TODO: Add toast notification for error
      alert(`Error deleting role: ${err.message}`);
      console.error("Error deleting role:", err.message);
    },
  });

  const handleOpenCreateRoleDialog = () => {
    setEditingRole(null);
    setIsRoleFormOpen(true);
  };

  const handleOpenEditRoleDialog = (role: AppRole) => {
    setEditingRole(role);
    setIsRoleFormOpen(true);
  };

  const handleDeleteRole = (roleId: number) => {
    // Add any confirmation or checks here, e.g., if role is in use.
    // The backend /api/roles/:id DELETE should handle FK constraints (cascade or prevent).
    if (window.confirm('Are you sure you want to delete this role? This might affect users assigned to this role.')) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  if (isLoading) return <p>Loading roles...</p>;
  if (error) return <p className="text-red-500">Error fetching roles: {error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Role Management</h2>
        <Button onClick={handleOpenCreateRoleDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Role
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles?.map((role) => (
            <TableRow key={role.id}>
              <TableCell>{role.id}</TableCell>
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell>{role.description || '-'}</TableCell>
              <TableCell><Badge variant="secondary">{role.category || '-'}</Badge></TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEditRoleDialog(role)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleDeleteRole(role.id)}
                  disabled={deleteRoleMutation.isPending && deleteRoleMutation.variables === role.id}
                >
                  {deleteRoleMutation.isPending && deleteRoleMutation.variables === role.id ? "..." : <Trash2 className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <RoleFormDialog
        open={isRoleFormOpen}
        onOpenChange={setIsRoleFormOpen}
        roleToEdit={editingRole}
      />
    </div>
  );
};

export default RoleManagementTab;
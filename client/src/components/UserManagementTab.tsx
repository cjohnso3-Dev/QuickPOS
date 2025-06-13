import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type UserWithRoles } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import UserFormDialog from './UserFormDialog'; // Import the dialog
import { useState } from 'react'; // Import useState

async function fetchUsers(): Promise<UserWithRoles[]> {
  const response = await fetch('/api/users');
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

async function deleteUserApi(userId: number): Promise<void> {
  const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete user');
  }
}

const UserManagementTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);

  const { data: users, isLoading, error } = useQuery<UserWithRoles[], Error>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // TODO: Add toast notification for success (e.g., using useToast hook)
      alert('User deleted successfully!');
    },
    onError: (err: Error) => {
      // TODO: Add toast notification for error
      alert(`Error deleting user: ${err.message}`);
      console.error("Error deleting user:", err.message);
    },
  });

  const handleOpenCreateUserDialog = () => {
    setEditingUser(null);
    setIsUserFormOpen(true);
  };

  const handleOpenEditUserDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setIsUserFormOpen(true);
  };

  const handleDeleteUser = (userId: number) => {
    // Check if trying to delete the default manager
    const userToDelete = users?.find(u => u.id === userId);
    if (userToDelete?.employeeCode === '12345') {
        alert("The default manager user (12345) cannot be deleted from the UI for safety.");
        return;
    }
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteMutation.mutate(userId);
    }
  };

  if (isLoading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">Error fetching users: {error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <Button onClick={handleOpenCreateUserDialog}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.employeeCode}</TableCell>
              <TableCell>{user.firstName} {user.lastName}</TableCell>
              <TableCell>{user.email || '-'}</TableCell>
              <TableCell>
                {user.roles?.map(role => (
                  <Badge key={role.id} variant="outline" className="mr-1 mb-1">{role.name}</Badge>
                )) || 'No roles'}
              </TableCell>
              <TableCell>
                <Badge variant={user.isActive ? 'default' : 'destructive'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEditUserDialog(user)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteUser(user.id)}
                  disabled={deleteMutation.isPending && deleteMutation.variables === user.id}
                >
                  {deleteMutation.isPending && deleteMutation.variables === user.id ? "..." : <Trash2 className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <UserFormDialog
        open={isUserFormOpen}
        onOpenChange={setIsUserFormOpen}
        userToEdit={editingUser}
      />
    </div>
  );
};

export default UserManagementTab;
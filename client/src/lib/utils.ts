import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"
import { UserWithRoles } from "@shared/schema"; // Import UserWithRoles

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to check if a user has any of the required roles
export const hasRequiredRole = (user: UserWithRoles | null, requiredRoles: string[]): boolean => {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.some(role => requiredRoles.includes(role.name));
};

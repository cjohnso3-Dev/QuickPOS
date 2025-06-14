import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertCategorySchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderApiPayloadSchema, // Added
  insertOrderItemSchema,
  insertPaymentSchema,
  insertDiscountSchema,
  insertTaxRateSchema,
  insertSettingSchema,
  insertAppRoleSchema, // Added import
  users as usersTable, // alias to avoid conflict
  appRoles as appRolesTable,
  userAppRoles as userAppRolesTable
} from "@shared/schema";
import { ZodError } from "zod";
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { type Request, type Response, type NextFunction } from "express"; // For middleware types


// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Middleware to check if user has a specific role (or one of several roles)
const hasRole = (requiredRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user || !req.session.user.roles) {
      return res.status(403).json({ message: "Forbidden: No roles assigned" });
    }
    const userRoles = req.session.user.roles.map(role => role.name);
    const hasRequiredRole = Array.isArray(requiredRoles)
      ? requiredRoles.some(role => userRoles.includes(role))
      : userRoles.includes(requiredRoles);

    if (hasRequiredRole) {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  };
};

export async function registerRoutes(app: Express): Promise<Server> {

  const productManagementRoles = ['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager'];

  // Authentication Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { employeeCode, pin } = req.body;
      if (!employeeCode) {
        return res.status(400).json({ message: "Employee code is required" });
      }

      const user = await storage.getUserByEmployeeCode(employeeCode);

      if (!user) {
        return res.status(401).json({ message: "Invalid employee code or PIN" });
      }

      if (user.pinHash) { // PIN is set for this user
        if (!pin) {
          return res.status(400).json({ message: "PIN is required for this user" });
        }
        const pinMatch = await bcrypt.compare(pin, user.pinHash);
        if (!pinMatch) {
          return res.status(401).json({ message: "Invalid employee code or PIN" });
        }
      } else if (pin) {
        // User does not have a PIN set, but one was provided - this could be an error or an attempt to set one.
        // For login, if no PIN is set on the user, and one is provided, it's a mismatch.
        return res.status(401).json({ message: "PIN not set for this user, but PIN was provided." });
      }
      
      // Successfully authenticated
      // Store user information in session (excluding sensitive data like pinHash)
      const { pinHash, ...userSessionData } = user;
      req.session.user = userSessionData;
      
      console.log(`[DEBUG] Login successful for user ID: ${userSessionData.id}`);
      console.log(`[DEBUG] User roles: ${JSON.stringify(userSessionData.roles)}`);

      res.json({ message: "Login successful", user: userSessionData });

    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid'); // Default cookie name for express-session
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post("/api/auth/switch-user", async (req, res) => {
    try {
      const { employeeCode, pin } = req.body;
      if (!employeeCode) {
        return res.status(400).json({ message: "Employee code is required" });
      }

      // Log out current user if any
      if (req.session.user) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session during user switch:", err);
            // Don't necessarily fail the whole switch, but log it
          }
        });
      }
      
      // Proceed with logging in the new user
      const user = await storage.getUserByEmployeeCode(employeeCode);

      if (!user) {
        return res.status(401).json({ message: "Invalid employee code or PIN" });
      }

      if (user.pinHash) {
        if (!pin) {
          return res.status(400).json({ message: "PIN is required for this user" });
        }
        const pinMatch = await bcrypt.compare(pin, user.pinHash);
        if (!pinMatch) {
          return res.status(401).json({ message: "Invalid employee code or PIN" });
        }
      } else if (pin) {
        return res.status(401).json({ message: "PIN not set for this user, but PIN was provided." });
      }
      
      const { pinHash, ...userSessionData } = user;
      // req.session.user = userSessionData; // This will be set by the new session

      // Manually create a new session for the new user
      req.session.regenerate((err) => {
        if (err) {
          console.error("Error regenerating session during user switch:", err);
          return res.status(500).json({ message: "User switch failed during session regeneration" });
        }
        req.session.user = userSessionData;
        res.json({ message: "User switch successful", user: userSessionData });
      });

    } catch (error) {
      console.error("Error during user switch:", error);
      res.status(500).json({ message: "User switch failed" });
    }
  });

  app.get("/api/users/lookup/:employeeCode", async (req, res) => {
    try {
      const { employeeCode } = req.params;
      if (!employeeCode || employeeCode.length !== 5 || !/^\d+$/.test(employeeCode)) {
        return res.status(400).json({ message: "Invalid employee code. Must be a 5-digit number." });
      }

      const user = await storage.getUserByEmployeeCode(employeeCode);

      if (!user) {
        return res.status(404).json({ message: "Employee code not found" });
      }

      const { firstName, lastName, pinHash, id } = user;
      const name = `${firstName} ${lastName}`;
      const avatarUrl = null; // No avatarUrl in UserWithRoles
      const requiresPin = !!pinHash;

      res.status(200).json({
        name,
        avatarUrl,
        requiresPin,
        code: employeeCode,
        id
      });
    } catch (error) {
      console.error("Error looking up employee:", error);
      res.status(500).json({ message: "Failed to lookup employee" });
    }
  });
  
  // User Management (CRUD) - Protected by authentication and admin/manager role
  app.get("/api/users", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      // Separate PIN for hashing, roles for separate assignment
      const { pin, roles, ...userDataPayload } = req.body;
      const parsedUserData = insertUserSchema.parse(userDataPayload);

      let pinHash: string | null = null;
      if (pin) {
        if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
          return res.status(400).json({ message: "PIN must be a 4-digit string" });
        }
        pinHash = await bcrypt.hash(pin, 10);
      }

      const finalUserData = { ...parsedUserData, pinHash };
      const newUser = await storage.createUser(finalUserData);

      if (roles && Array.isArray(roles) && newUser && newUser.id) {
        try {
          for (const roleId of roles) {
            if (typeof roleId === 'number') {
              await storage.assignRoleToUser(newUser.id, roleId);
            } else {
              console.warn(`Invalid roleId type: ${typeof roleId} for user ${newUser.id}`);
            }
          }
        } catch (roleError) {
          // Log the error but don't fail the entire user creation,
          // as user record itself was created. Client can be notified or handle this.
          console.error(`Error assigning roles to new user ${newUser.id}:`, roleError);
          // Optionally, could add a partial success message or flag to the response
        }
      }

      const userWithDetails = await storage.getUser(newUser.id); // Fetch user again to include roles
      res.status(201).json(userWithDetails);

    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const authenticatedUser = req.session.user;
  
      // Allow user to fetch their own details, or if they have admin/manager role
      const isAdminOrManager = authenticatedUser && authenticatedUser.roles ? authenticatedUser.roles.some(role => ['General Manager (GM) / Store Manager', 'Assistant Manager'].includes(role.name)) : false;
  
      console.log(`[DEBUG] GET /api/users/:id - Auth Check:`);
      console.log(`[DEBUG]   req.params.id (parsed as id): ${id} (type: ${typeof id})`);
      console.log(`[DEBUG]   authenticatedUser: ${JSON.stringify(authenticatedUser)}`);
      if (authenticatedUser) {
        console.log(`[DEBUG]   authenticatedUser.id: ${authenticatedUser.id} (type: ${typeof authenticatedUser.id})`);
      } else {
        console.log(`[DEBUG]   authenticatedUser is null or undefined.`);
      }
      console.log(`[DEBUG]   isAdminOrManager: ${isAdminOrManager}`);
      console.log(`[DEBUG]   Condition 1 (!isAdminOrManager): ${!isAdminOrManager}`);
      console.log(`[DEBUG]   Condition 2.1 (!authenticatedUser): ${!authenticatedUser}`);
      console.log(`[DEBUG]   Condition 2.2 (authenticatedUser.id !== id): ${authenticatedUser ? authenticatedUser.id !== id : 'N/A (authenticatedUser is null)'}`);
      console.log(`[DEBUG]   Condition 2 combined ((!authenticatedUser || authenticatedUser.id !== id)): ${(!authenticatedUser || (authenticatedUser && authenticatedUser.id !== id))}`);
      console.log(`[DEBUG]   Overall if condition: ${!isAdminOrManager && (!authenticatedUser || (authenticatedUser && authenticatedUser.id !== id))}`);
  
      if (!isAdminOrManager && (!authenticatedUser || authenticatedUser.id !== id)) {
         console.log(`[DEBUG] GET /api/users/:id - Failing auth check. Sending 403.`);
         return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await storage.getUser(id); // This should fetch UserWithRoles
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { pin, roles, ...userDataPayload } = req.body;
      // Use .partial() as it's an update
      const parsedUserData = insertUserSchema.partial().parse(userDataPayload);

      let pinHash: string | undefined | null = undefined; // undefined means no change, null means remove PIN
      if (pin === null) { // Explicitly removing PIN
        pinHash = null;
      } else if (pin) { // Setting or changing PIN
        if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
          return res.status(400).json({ message: "PIN must be a 4-digit string" });
        }
        pinHash = await bcrypt.hash(pin, 10);
      }

      const finalUserData: Partial<typeof usersTable.$inferInsert> = { ...parsedUserData };
      if (pinHash !== undefined) { // only add pinHash to update if it was actually processed
        finalUserData.pinHash = pinHash;
      }
      
      const updatedUser = await storage.updateUser(id, finalUserData);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found or update failed" });
      }

      if (roles && Array.isArray(roles)) {
        try {
          const currentRoles = await storage.getUserRoles(id);
          const currentRoleIds = currentRoles.map(role => role.id);

          const rolesToAdd = roles.filter((roleId: any) => typeof roleId === 'number' && !currentRoleIds.includes(roleId));
          const rolesToRemove = currentRoleIds.filter((roleId: any) => !roles.includes(roleId));

          for (const roleId of rolesToAdd) {
            await storage.assignRoleToUser(id, roleId);
          }
          for (const roleId of rolesToRemove) {
            await storage.removeRoleFromUser(id, roleId);
          }
        } catch (roleError) {
          console.error(`Error updating roles for user ${id}:`, roleError);
          // Log error, but let the main user update succeed.
          // Client could be informed about partial success if necessary.
        }
      } else if (roles && Array.isArray(roles) && roles.length === 0) { // Empty array means remove all roles
        try {
          const currentRoles = await storage.getUserRoles(id);
          for (const role of currentRoles) {
            await storage.removeRoleFromUser(id, role.id);
          }
        } catch (roleError) {
          console.error(`Error removing all roles for user ${id}:`, roleError);
        }
      }
      // If 'roles' key is not in req.body, no changes to roles are made.
      
      const userWithDetails = await storage.getUser(updatedUser.id); // Fetch again to get full details including roles
      res.json(userWithDetails);

    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      // Prevent deleting the default manager seeded user for safety, could be configurable
      const userToDelete = await storage.getUser(id);
      if (userToDelete?.employeeCode === '12345') {
          return res.status(403).json({ message: "Cannot delete the default manager user." });
      }

      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found or could not be deleted" });
      }
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // AppRoles CRUD - Protected by authentication and admin role
  app.get("/api/roles", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const roles = await storage.getAppRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const roleData = insertAppRoleSchema.parse(req.body);
      const newRole = await storage.createAppRole(roleData);
      res.status(201).json(newRole);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.get("/api/roles/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      const role = await storage.getAppRole(id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.put("/api/roles/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      const roleData = insertAppRoleSchema.partial().parse(req.body);
      const updatedRole = await storage.updateAppRole(id, roleData);
      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found or update failed" });
      }
      res.json(updatedRole);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid role ID" });
      }
      // Consider implications: what if users are assigned this role?
      // Might need to prevent deletion if in use, or reassign users, or cascade delete userAppRoles.
      // For now, simple delete. Drizzle schema has onDelete: "cascade" for userAppRoles.
      const success = await storage.deleteAppRole(id);
      if (!success) {
        return res.status(404).json({ message: "Role not found or could not be deleted" });
      }
      res.status(200).json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // User-Role Assignments - Protected by authentication and admin role
  app.post("/api/users/:userId/roles", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { roleId } = req.body;
      if (isNaN(userId) || typeof roleId !== 'number') {
        return res.status(400).json({ message: "Invalid user ID or role ID" });
      }
      const assignment = await storage.assignRoleToUser(userId, roleId);
      res.status(201).json(assignment);
    } catch (error: any) { // Typed error object
      // Handle potential errors, e.g., user or role not found, already assigned
      console.error("Error assigning role to user:", error);
      if (error.message && error.message.includes("UNIQUE constraint failed")) { // Example for specific error
          return res.status(409).json({ message: "Role already assigned to this user or invalid IDs." });
        }
      res.status(500).json({ message: "Failed to assign role to user" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const roleId = parseInt(req.params.roleId);
      if (isNaN(userId) || isNaN(roleId)) {
        return res.status(400).json({ message: "Invalid user ID or role ID" });
      }
      const success = await storage.removeRoleFromUser(userId, roleId);
      if (!success) {
        return res.status(404).json({ message: "User-role assignment not found or could not be deleted" });
      }
      res.status(200).json({ message: "Role removed from user successfully" });
    } catch (error) {
      console.error("Error removing role from user:", error);
      res.status(500).json({ message: "Failed to remove role from user" });
    }
  });


  // Time Clock Management
  app.post("/api/users/:id/clock-in", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const event = await storage.createTimeClockEvent(userId, "clock-in");
      res.json(event);
    } catch (error) {
      console.error("Error clocking in:", error);
      res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post("/api/users/:id/clock-out", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const lastEvent = await storage.getLatestTimeClockEvent(userId);

      if (lastEvent?.eventType === 'break-start') {
        await storage.createTimeClockEvent(userId, "break-end");
      }

      const event = await storage.createTimeClockEvent(userId, "clock-out");
      res.json(event);
    } catch (error) {
      console.error("Error clocking out:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  app.get("/api/users/:id/time-clocks", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const authenticatedUser = req.session.user;
      const isAdmin = authenticatedUser?.roles?.some(role => ['General Manager (GM) / Store Manager', 'Assistant Manager'].includes(role.name)) ?? false;

      if (!isAdmin && authenticatedUser?.id !== userId) {
        return res.status(403).json({ message: "Forbidden: Cannot view another user's time clocks" });
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const timeClockEvents = await storage.getTimeClockEvents(userId, startDate, endDate);
      res.json(timeClockEvents);
    } catch (error) {
      console.error("Error fetching time clocks:", error);
      res.status(500).json({ message: "Failed to fetch time clocks" });
    }
  });

  // Route for /api/users/:userId/timeclock-details
  app.get("/api/users/:userId/timeclock-details", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const authenticatedUser = req.session.user;
      const isAdmin = authenticatedUser?.roles?.some(role => ['General Manager (GM) / Store Manager', 'Assistant Manager'].includes(role.name)) ?? false;

      if (!isAdmin && authenticatedUser?.id !== userId) {
        return res.status(403).json({ message: "Forbidden: Cannot view another user's timeclock details" });
      }

      const timeClockEvents = await storage.getTimeClockEvents(userId);
      res.json(timeClockEvents);
    } catch (error) {
      console.error("Error fetching timeclock details:", error);
      res.status(500).json({ message: "Failed to fetch timeclock details" });
    }
  });

  // Route for /api/time-clocks/user/:userId/today
  app.get("/api/time-clocks/user/:userId/today", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const authenticatedUser = req.session.user;
      const isAdmin = authenticatedUser?.roles?.some(role => ['General Manager (GM) / Store Manager', 'Assistant Manager'].includes(role.name)) ?? false;

      if (!isAdmin && authenticatedUser?.id !== userId) {
        return res.status(403).json({ message: "Forbidden: Cannot view another user's time clocks" });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const timeClockEvents = await storage.getTimeClockEvents(userId, todayStart, todayEnd);
      res.setHeader('Content-Type', 'application/json');
      res.json(timeClockEvents);
    } catch (error) {
      console.error("Error fetching today's time clocks:", error);
      res.status(500).json({ message: "Failed to fetch today's time clocks" });
    }
  });

  // Route for /api/time-clocks/user/:userId/week
  app.get("/api/time-clocks/user/:userId/week", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      const authenticatedUser = req.session.user;
      const isAdmin = authenticatedUser?.roles?.some(role => ['General Manager (GM) / Store Manager', 'Assistant Manager'].includes(role.name)) ?? false;

      if (!isAdmin && authenticatedUser?.id !== userId) {
        return res.status(403).json({ message: "Forbidden: Cannot view another user's time clocks" });
      }

      const today = new Date();
      const currentDay = today.getDay();
      
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - currentDay);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + (6 - currentDay));
      weekEnd.setHours(23, 59, 59, 999);

      const timeClockEvents = await storage.getTimeClockEvents(userId, weekStart, weekEnd);
      res.setHeader('Content-Type', 'application/json');
      res.json(timeClockEvents);
    } catch (error) {
      console.error("Error fetching week's time clocks:", error);
      res.status(500).json({ message: "Failed to fetch week's time clocks" });
    }
  });

  // New Break Management Endpoints
  app.post("/api/time-clocks/active/start-break", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const event = await storage.createTimeClockEvent(userId, "break-start");
      res.json(event);
    } catch (error) {
      console.error("Error starting break:", error);
      res.status(500).json({ message: "Failed to start break" });
    }
  });

  app.post("/api/time-clocks/active/end-break", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const event = await storage.createTimeClockEvent(userId, "break-end");
      res.json(event);
    } catch (error) {
      console.error("Error ending break:", error);
      res.status(500).json({ message: "Failed to end break" });
    }
  });


  // Categories - Protected by authentication (any logged-in user can view, specific roles for CUD)
  app.get("/api/categories", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCategory(id);
      if (!success) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Products - Protected by authentication (any logged-in user can view, specific roles for CUD)
  app.get("/api/products", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.patch("/api/products/:id/stock", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { stock } = req.body;
      const product = await storage.updateProductStock(id, stock);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product stock:", error);
      res.status(500).json({ message: "Failed to update product stock" });
    }
  });

  // Orders - Protected by authentication (any logged-in user can view, specific roles for CUD)
  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const orders = await storage.getOrders({ status });
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => { // All authenticated users can create orders
    try {
      const orderData = insertOrderApiPayloadSchema.parse(req.body); // Use new schema
      const order = await storage.createOrder(orderData);
      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const orderData = insertOrderSchema.partial().parse(req.body);
      const order = await storage.updateOrder(id, orderData);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.patch("/api/orders/:id/status", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, managedBy } = req.body;
      const order = await storage.updateOrderStatus(id, status, managedBy);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });
  
  // Order Items
  // This existing route seems to be for individual item creation,
  // which is what we need for the createOrderItemMutation.
  // We'll ensure it's correctly used and the storage method supports it.
  app.post("/api/order-items", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      // The frontend's createOrderItemMutation sends an object that should match InsertOrderItem
      // (which is `typeof orderItems.$inferInsert`)
      // insertOrderItemSchema is `typeof orderItems.$inferInsert` after Zod parsing.
      const orderItemData = insertOrderItemSchema.parse(req.body);
      const orderItem = await storage.createOrderItem(orderItemData);
      res.status(201).json(orderItem); // Return 201 for successful creation
    } catch (error) {
      console.error("Error creating order item:", error);
      // Provide more specific error messages if possible (e.g., from Zod validation)
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid order item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create order item" });
    }
  });

  app.put("/api/order-items/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const orderItemData = insertOrderItemSchema.partial().parse(req.body);
      const orderItem = await storage.updateOrderItem(id, orderItemData);
      if (!orderItem) {
        return res.status(404).json({ message: "Order item not found" });
      }
      res.json(orderItem);
    } catch (error) {
      console.error("Error updating order item:", error);
      res.status(500).json({ message: "Failed to update order item" });
    }
  });

  app.delete("/api/order-items/:id", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteOrderItem(id);
      if (!success) {
        return res.status(404).json({ message: "Order item not found" });
      }
      res.json({ message: "Order item deleted successfully" });
    } catch (error) {
      console.error("Error deleting order item:", error);
      res.status(500).json({ message: "Failed to delete order item" });
    }
  });

  app.patch("/api/order-items/:id/comp", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { compedBy, reason } = req.body;
      const orderItem = await storage.compOrderItem(id, compedBy, reason);
      if (!orderItem) {
        return res.status(404).json({ message: "Order item not found" });
      }
      res.json(orderItem);
    } catch (error) {
      console.error("Error comping order item:", error);
      res.status(500).json({ message: "Failed to comp order item" });
    }
  });

  // Payments - Protected by authentication
  app.post("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.get("/api/orders/:orderId/payments", isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const payments = await storage.getPayments(orderId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments/:id/refund", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      const { amount, processedBy } = req.body;
      const refund = await storage.processRefund(paymentId, amount, processedBy);
      res.json(refund);
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ message: "Failed to process refund" });
    }
  });

  // Discounts - Protected by authentication (view for all), CUD for admin/manager
  app.get("/api/discounts", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager']), async (req, res) => {
    try {
      const discounts = await storage.getDiscounts();
      res.json(discounts);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ message: "Failed to fetch discounts" });
    }
  });

  app.post("/api/discounts", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager']), async (req, res) => {
    try {
      const discountData = insertDiscountSchema.parse(req.body);
      const discount = await storage.createDiscount(discountData);
      res.json(discount);
    } catch (error) {
      console.error("Error creating discount:", error);
      res.status(500).json({ message: "Failed to create discount" });
    }
  });

  // Tax Rates - Protected by authentication (view for all), CUD for admin/manager
  app.get("/api/tax-rates", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager']), async (req, res) => { // View for all authenticated
    try {
      const taxRates = await storage.getTaxRates();
      res.json(taxRates);
    } catch (error) {
      console.error("Error fetching tax rates:", error);
      res.status(500).json({ message: "Failed to fetch tax rates" });
    }
  });

  app.get("/api/tax-rates/default", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager']), async (req, res) => { // View for all authenticated
    try {
      const defaultTaxRate = await storage.getDefaultTaxRate();
      res.json(defaultTaxRate);
    } catch (error) {
      console.error("Error fetching default tax rate:", error);
      res.status(500).json({ message: "Failed to fetch default tax rate" });
    }
  });

  app.post("/api/tax-rates", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const taxRateData = insertTaxRateSchema.parse(req.body);
      const newTaxRate = await storage.createTaxRate(taxRateData);
      res.json(newTaxRate);
    } catch (error) {
      console.error("Error creating tax rate:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid tax rate data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create tax rate" });
    }
  });

  app.put("/api/tax-rates/:id", isAuthenticated, hasRole(productManagementRoles), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const taxRateData = insertTaxRateSchema.partial().parse(req.body);
      const updatedTaxRate = await storage.updateTaxRate(id, taxRateData);
      if (!updatedTaxRate) {
        return res.status(404).json({ message: "Tax rate not found or update failed" });
      }
      res.json(updatedTaxRate);
    } catch (error) {
      console.error("Error updating tax rate:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid tax rate data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tax rate" });
    }
  });

  // Settings - Protected by authentication and admin/manager role
  app.get("/api/settings", isAuthenticated, hasRole(['General Manager (GM) / Store Manager']), async (req, res) => {
    try {
      const category = req.query.category as string;
      const settings = await storage.getSettings(category);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", isAuthenticated, hasRole(['General Manager (GM) / Store Manager']), async (req, res) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSetting(key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", isAuthenticated, hasRole(['General Manager (GM) / Store Manager']), async (req, res) => {
    try {
      const key = req.params.key;
      const { value, category, description } = req.body;
      const setting = await storage.setSetting(key, value, category, description);
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Reports and Analytics - Protected by authentication and admin/manager role
  app.get("/api/stats/today", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const stats = await storage.getTodayStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching today's stats:", error);
      res.status(500).json({ message: "Failed to fetch today's stats" });
    }
  });

  app.get("/api/reports/sales", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const report = await storage.getSalesReport(startDate, endDate);
      res.json(report);
    } catch (error) {
      console.error("Error generating sales report:", error);
      res.status(500).json({ message: "Failed to generate sales report" });
    }
  });

  app.get("/api/reports/employees", isAuthenticated, hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager']), async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const report = await storage.getEmployeeReport(userId, startDate, endDate);
      res.json(report);
    } catch (error) {
      console.error("Error generating employee report:", error);
      res.status(500).json({ message: "Failed to generate employee report" });
    }
  });

  // Stripe Payment Processing
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ 
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id 
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
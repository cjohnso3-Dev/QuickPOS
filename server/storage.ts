import { 
  users,
  timeClockEvents,
  categories, 
  products, 
  orders, 
  orderItems, 
  payments,
  discounts,
  taxRates,
  auditLogs,
  settings,
  type User,
  type TimeClockEvent,
  type Category, 
  type Product, 
  type Order, 
  type OrderItem, 
  type Payment,
  type Discount,
  type TaxRate,
  type AuditLog,
  type Setting,
  type InsertUser,
  type InsertTimeClockEvent,
  type InsertCategory, 
  type InsertProduct, 
  type InsertOrder, 
  type InsertOrderItem,
  type InsertPayment,
  type InsertDiscount,
  type InsertTaxRate,
  type InsertAuditLog,
  type InsertSetting,
  type InsertOrderApiPayload, // Added
  type UserWithTimeClock,
  type ProductWithCategory,
  type OrderWithDetails,
  type CartItem,
  type PaymentSplit,
  appRoles,
  userAppRoles,
  type InsertAppRole, // Added for new methods
  type UserAppRole,   // Added for new methods
  type AppRole,       // Added for new methods
  type UserWithRoles,  // Import UserWithRoles
  apiOrderItemSchema, // Import for createOrder items
  type InsertOrderItem as SharedInsertOrderItem, // Alias to avoid conflict
  type ProductModification // For parsing product modificationOptions
} from "@shared/schema";
import { db } from './db';
import { z } from 'zod'; // Import z from zod
import { eq, and, asc, desc, sql, sum, gte, lte, isNull, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core'; // Added for DbStorage


export interface IStorage {
  // Users
  getUsers(): Promise<UserWithTimeClock[]>; // Correctly returns UserWithTimeClock[]
  getUser(id: number): Promise<UserWithTimeClock | undefined>;
  getUserByEmployeeCode(employeeCode: string): Promise<UserWithRoles | undefined>; // New method
  getUserByUsername(username: string): Promise<User | undefined>; // This might be deprecated or changed
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // AppRoles
  getAppRoles(): Promise<AppRole[]>;
  getAppRole(id: number): Promise<AppRole | undefined>;
  createAppRole(roleData: InsertAppRole): Promise<AppRole>;
  updateAppRole(id: number, roleData: Partial<InsertAppRole>): Promise<AppRole | undefined>;
  deleteAppRole(id: number): Promise<boolean>;

  // UserAppRoles
  assignRoleToUser(userId: number, roleId: number): Promise<UserAppRole>;
  removeRoleFromUser(userId: number, roleId: number): Promise<boolean>;
  getUserRoles(userId: number): Promise<AppRole[]>;
  
  // Time Clock Events
  createTimeClockEvent(userId: number, eventType: 'clock-in' | 'clock-out' | 'break-start' | 'break-end'): Promise<TimeClockEvent>;
  getLatestTimeClockEvent(userId: number): Promise<TimeClockEvent | undefined>;
  getTimeClockEvents(userId: number, startDate?: Date, endDate?: Date): Promise<TimeClockEvent[]>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Products
  getProducts(): Promise<ProductWithCategory[]>;
  getProduct(id: number): Promise<ProductWithCategory | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  updateProductStock(id: number, stock: number): Promise<Product | undefined>;
  
  // Orders
  getOrders(filters?: { status?: string }): Promise<OrderWithDetails[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrderApiPayload): Promise<Order>; // Modified
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: number, status: string, managedBy?: number): Promise<Order | undefined>;
  
  // Order Items
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: number, orderItem: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  deleteOrderItem(id: number): Promise<boolean>;
  compOrderItem(id: number, compedBy: number, reason: string): Promise<OrderItem | undefined>;
  getOrderItems(orderId: number): Promise<(OrderItem & { product: Product })[]>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayments(orderId: number): Promise<Payment[]>;
  processRefund(paymentId: number, amount: number, processedBy: number): Promise<Payment>;
  
  // Discounts
  getDiscounts(): Promise<Discount[]>;
  createDiscount(discount: InsertDiscount): Promise<Discount>;
  updateDiscount(id: number, discount: Partial<InsertDiscount>): Promise<Discount | undefined>;
  deleteDiscount(id: number): Promise<boolean>;
  
  // Tax Rates
  getTaxRates(): Promise<TaxRate[]>;
  getDefaultTaxRate(): Promise<TaxRate | undefined>;
  createTaxRate(taxRate: InsertTaxRate): Promise<TaxRate>;
  updateTaxRate(id: number, taxRate: Partial<InsertTaxRate>): Promise<TaxRate | undefined>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(entityType?: string, entityId?: number): Promise<AuditLog[]>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string, category?: string, description?: string): Promise<Setting>;
  getSettings(category?: string): Promise<Setting[]>;
  
  // Reports and Stats
  getTodayStats(): Promise<{
    todaySales: number;
    todayOrders: number;
    lowStockCount: number;
    activeProductCount: number;
    todayTips: number;
    averageOrderValue: number;
  }>;
  
  getSalesReport(startDate: Date, endDate: Date): Promise<any>;
  getEmployeeReport(userId?: number, startDate?: Date, endDate?: Date): Promise<any>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUserByEmployeeCode(employeeCode: string): Promise<UserWithRoles | undefined> {
    const result = await db.select()
      .from(users)
      .where(eq(users.employeeCode, employeeCode))
      .leftJoin(userAppRoles, eq(users.id, userAppRoles.userId))
      .leftJoin(appRoles, eq(userAppRoles.roleId, appRoles.id))
      .limit(1); // Ensure we only get one user if multiple rows due to roles

    if (result.length === 0 || !result[0].users) {
      return undefined;
    }
    
    // Need to aggregate roles for the user if multiple roles exist
    // For now, let's fetch all roles for that user in a separate query or process results
    const userRecord = result[0].users;

    let rolesResult: AppRole[] = [];
    try {
      rolesResult = await db.select({
          id: appRoles.id,
          name: appRoles.name,
          description: appRoles.description,
          category: appRoles.category,
        })
        .from(userAppRoles)
        .innerJoin(appRoles, eq(userAppRoles.roleId, appRoles.id))
        .where(eq(userAppRoles.userId, userRecord.id));
    } catch (error) {
      console.error(`Error fetching roles for user ${userRecord.id}:`, error);
      // Continue with an empty roles array if fetching fails
    }

    return {
      ...userRecord,
      roles: rolesResult || [],
    };
  }
 
  async getUsers(): Promise<UserWithTimeClock[]> {
    const userList = await db.select().from(users);
    const usersWithData: UserWithTimeClock[] = [];
    for (const user of userList) {
      const roles = await this.getUserRoles(user.id);
      const timeClockEvents = await this.getTimeClockEvents(user.id);
      usersWithData.push({
        ...user,
        roles,
        timeClockEvents,
      });
    }
    return usersWithData;
  }

  async getUser(id: number): Promise<UserWithTimeClock | undefined> {
    const userResult = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (userResult.length === 0) {
      return undefined;
    }
    const userRecord = userResult[0];
    let roles: AppRole[] = [];
    try {
      roles = await this.getUserRoles(userRecord.id);
    } catch (error) {
      console.error(`Error fetching roles for user ${userRecord.id}:`, error);
      // Continue with an empty roles array if fetching fails
    }
    
    const timeClockEvents = await this.getTimeClockEvents(userRecord.id);
    
    const userToReturn = {
      ...userRecord,
      roles,
      timeClockEvents,
    };
    return userToReturn;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // This method is likely deprecated in favor of getUserByEmployeeCode.
    // If it needs to be kept, it should be defined what 'username' refers to (e.g., email).
    console.warn("DbStorage.getUserByUsername() is deprecated. Use getUserByEmployeeCode or clarify username field.");
    // Example: find by email if username is treated as email
    // const result = await db.select().from(users).where(eq(users.email, username)).limit(1);
    // return result[0];
    return undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Assumes userData includes pinHash if a PIN was provided (handled by route)
    const [newUser] = await db.insert(users).values(userData).returning();
    // Role assignment is handled by assignRoleToUser via a separate route.
    // If default roles were to be assigned on creation, that logic would be here.
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    // Assumes userData might include pinHash if PIN is being updated (handled by route)
    const [updatedUser] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    // Role updates are handled by assignRoleToUser/removeRoleFromUser via separate routes.
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    // First, delete related time clock entries as they don't have onDelete: "cascade"
    await db.delete(timeClockEvents).where(eq(timeClockEvents.userId, id));
    
    // UserAppRoles have onDelete: "cascade" in their schema definition,
    // so they should be deleted automatically when the user is deleted if DB foreign key enforcement is on.
    // If not, they would need to be deleted manually here too:
    // await db.delete(userAppRoles).where(eq(userAppRoles.userId, id));

    const result = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return result.length > 0;
  }

  // AppRoles methods
  async getAppRoles(): Promise<AppRole[]> {
    return db.select().from(appRoles);
  }
  async getAppRole(id: number): Promise<AppRole | undefined> {
    const result = await db.select().from(appRoles).where(eq(appRoles.id, id)).limit(1);
    return result[0];
  }
  async createAppRole(roleData: InsertAppRole): Promise<AppRole> {
    const [newRole] = await db.insert(appRoles).values(roleData).returning();
    return newRole;
  }
  async updateAppRole(id: number, roleData: Partial<InsertAppRole>): Promise<AppRole | undefined> {
    const [updatedRole] = await db.update(appRoles).set(roleData).where(eq(appRoles.id, id)).returning();
    return updatedRole;
  }
  async deleteAppRole(id: number): Promise<boolean> {
    // Drizzle schema for userAppRoles has onDelete: "cascade",
    // so related assignments in userAppRoles table will be deleted automatically by the DB if configured.
    // If not, manual deletion from userAppRoles would be needed here first.
    // For SQLite, CASCADE is often handled by PRAGMA foreign_keys=ON; and table definition.
    // Assuming cascade is effective.
    const result = await db.delete(appRoles).where(eq(appRoles.id, id)).returning({ id: appRoles.id });
    return result.length > 0;
  }

  // UserAppRoles methods
  async assignRoleToUser(userId: number, roleId: number): Promise<UserAppRole> {
    // Check if user and role exist before assigning
    const userExists = await db.select({id: users.id}).from(users).where(eq(users.id, userId)).limit(1);
    const roleExists = await db.select({id: appRoles.id}).from(appRoles).where(eq(appRoles.id, roleId)).limit(1);

    if (userExists.length === 0) throw new Error(`User with ID ${userId} not found.`);
    if (roleExists.length === 0) throw new Error(`Role with ID ${roleId} not found.`);

    const [assignment] = await db.insert(userAppRoles).values({ userId, roleId }).onConflictDoNothing().returning();
     if (!assignment) { // If onConflictDoNothing caused no insert (already exists)
        const existing = await db.select().from(userAppRoles).where(and(eq(userAppRoles.userId, userId), eq(userAppRoles.roleId, roleId))).limit(1);
        if (existing[0]) return existing[0];
        throw new Error('Failed to assign role, assignment might already exist but not returned.'); // Should not happen if onConflictDoNothing
    }
    return assignment;
  }
  async removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    const result = await db.delete(userAppRoles).where(and(eq(userAppRoles.userId, userId), eq(userAppRoles.roleId, roleId))).returning({ userId: userAppRoles.userId });
    return result.length > 0;
  }
  async getUserRoles(userId: number): Promise<AppRole[]> {
     return db.select({
        id: appRoles.id,
        name: appRoles.name,
        description: appRoles.description,
        category: appRoles.category,
      })
      .from(userAppRoles)
      .innerJoin(appRoles, eq(userAppRoles.roleId, appRoles.id))
      .where(eq(userAppRoles.userId, userId));
  }

  // Time Clock Event methods
  async createTimeClockEvent(userId: number, eventType: 'clock-in' | 'clock-out' | 'break-start' | 'break-end'): Promise<TimeClockEvent> {
    const now = new Date();
    const eventData: InsertTimeClockEvent = {
      userId,
      eventType,
      eventTime: now,
    };
    const [newEvent] = await db.insert(timeClockEvents).values(eventData).returning();
    return newEvent;
  }

  async getLatestTimeClockEvent(userId: number): Promise<TimeClockEvent | undefined> {
    const result = await db.select()
      .from(timeClockEvents)
      .where(eq(timeClockEvents.userId, userId))
      .orderBy(desc(timeClockEvents.eventTime))
      .limit(1);
    return result[0];
  }

  async getTimeClockEvents(userId: number, startDate?: Date, endDate?: Date): Promise<TimeClockEvent[]> {
    const conditions = [eq(timeClockEvents.userId, userId)];
    if (startDate) {
      conditions.push(gte(timeClockEvents.eventTime, startDate));
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(timeClockEvents.eventTime, endOfDay));
    }
    return db.select().from(timeClockEvents).where(and(...conditions)).orderBy(desc(timeClockEvents.eventTime));
  }

  // Category methods (Stubs)
  async getCategories(): Promise<Category[]> {
    return db.select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder));
  }
  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(categoryData).returning();
    return newCategory;
  }
  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db.update(categories).set(categoryData).where(eq(categories.id, id)).returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    // Set categoryId to null for products associated with this category
    await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
    const result = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    return result.length > 0;
  }

  // Product methods
  async getProducts(): Promise<ProductWithCategory[]> {
    const result = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      categoryId: products.categoryId,
      imageUrl: products.imageUrl,
      sku: products.sku,
      stock: products.stock,
      minStock: products.minStock,
      maxStock: products.maxStock,
      isActive: products.isActive,
      hasSizes: products.hasSizes,
      allowModifications: products.allowModifications,
      itemType: products.itemType,
      requiresInventory: products.requiresInventory,
      taxable: products.taxable,
      serviceDetails: products.serviceDetails,
      modificationOptions: products.modificationOptions,
      createdAt: products.createdAt,
      category: categories // Select all columns from categories table
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name));

    return result.map(p => {
      let parsedModificationOptions: ProductModification[] | null = null;
      if (typeof p.modificationOptions === 'string') {
        try {
          parsedModificationOptions = JSON.parse(p.modificationOptions);
        } catch (e) {
          console.error(`Failed to parse modificationOptions for product ${p.id}:`, e);
          // Keep it as null or an empty array if parsing fails, depending on desired behavior
        }
      } else if (Array.isArray(p.modificationOptions)) {
        // This case handles if Drizzle somehow already parsed it (less likely for SQLite text column)
        // or if the data was in an unexpected format but was an array.
        parsedModificationOptions = p.modificationOptions as ProductModification[];
      }
      return {
        ...p,
        category: p.category?.id ? p.category : undefined,
        modificationOptions: parsedModificationOptions,
      };
    }) as ProductWithCategory[];
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const result = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      categoryId: products.categoryId,
      imageUrl: products.imageUrl,
      sku: products.sku,
      stock: products.stock,
      minStock: products.minStock,
      maxStock: products.maxStock,
      isActive: products.isActive,
      hasSizes: products.hasSizes,
      allowModifications: products.allowModifications,
      itemType: products.itemType,
      requiresInventory: products.requiresInventory,
      taxable: products.taxable,
      serviceDetails: products.serviceDetails,
      modificationOptions: products.modificationOptions,
      createdAt: products.createdAt,
      category: categories
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);

    if (result.length === 0) {
      return undefined;
    }
    const p = result[0];
    let parsedModificationOptions: ProductModification[] | null = null;
    if (typeof p.modificationOptions === 'string') {
      try {
        parsedModificationOptions = JSON.parse(p.modificationOptions);
      } catch (e) {
        console.error(`Failed to parse modificationOptions for product ${p.id}:`, e);
      }
    } else if (Array.isArray(p.modificationOptions)) {
        parsedModificationOptions = p.modificationOptions as ProductModification[];
    }
    return {
        ...p,
        category: p.category?.id ? p.category : undefined,
        modificationOptions: parsedModificationOptions,
    } as ProductWithCategory;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(productData).returning();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products).set(productData).where(eq(products.id, id)).returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    // Consider orderItems referencing this product.
    // For now, we'll allow deletion. A more robust solution might prevent deletion
    // if product is in existing non-completed orders or set product to inactive.
    const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return result.length > 0;
  }

  async updateProductStock(id: number, stock: number): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products).set({ stock }).where(eq(products.id, id)).returning();
    return updatedProduct;
  }

  // Order methods
  async getOrders(filters?: { status?: string }): Promise<OrderWithDetails[]> {
    const createdByAlias = alias(users, 'createdByAlias');
    const managedByAlias = alias(users, 'managedByAlias');

    let query = db.select({
      // Order fields
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      subtotal: orders.subtotal,
      tax: orders.tax,
      tipAmount: orders.tipAmount,
      discountAmount: orders.discountAmount,
      total: orders.total,
      status: orders.status,
      orderType: orders.orderType,
      tableNumber: orders.tableNumber,
      notes: orders.notes,
      createdBy: orders.createdBy,
      managedBy: orders.managedBy,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      // User fields
      createdByUser: createdByAlias,
      managedByUser: managedByAlias,
    })
    .from(orders)
    .leftJoin(createdByAlias, eq(orders.createdBy, createdByAlias.id))
    .leftJoin(managedByAlias, eq(orders.managedBy, managedByAlias.id))
    .orderBy(desc(orders.createdAt));

    if (filters?.status) {
      // query = query.where(eq(orders.status, filters.status)); // This line has a type error, Drizzle's where doesn't chain like this directly on assignment
      // Correct way to conditionally add where clause:
      query.where(eq(orders.status, filters.status));
    }

    const orderResults = await query;

    const ordersWithDetails: OrderWithDetails[] = [];
    for (const o of orderResults) {
      const items = await this.getOrderItems(o.id); // This will be implemented next
      const paymentRecords = await this.getPayments(o.id); // This will be implemented next
      ordersWithDetails.push({
        ...o,
        items,
        payments: paymentRecords,
        createdByUser: o.createdByUser?.id ? o.createdByUser : undefined,
        managedByUser: o.managedByUser?.id ? o.managedByUser : undefined,
      } as OrderWithDetails);
    }
    return ordersWithDetails;
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    const createdByAlias = alias(users, 'createdByAlias');
    const managedByAlias = alias(users, 'managedByAlias');

    const result = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      subtotal: orders.subtotal,
      tax: orders.tax,
      tipAmount: orders.tipAmount,
      discountAmount: orders.discountAmount,
      total: orders.total,
      status: orders.status,
      orderType: orders.orderType,
      tableNumber: orders.tableNumber,
      notes: orders.notes,
      createdBy: orders.createdBy,
      managedBy: orders.managedBy,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      createdByUser: createdByAlias,
      managedByUser: managedByAlias,
    })
    .from(orders)
    .leftJoin(createdByAlias, eq(orders.createdBy, createdByAlias.id))
    .leftJoin(managedByAlias, eq(orders.managedBy, managedByAlias.id))
    .where(eq(orders.id, id))
    .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const o = result[0];
    const items = await this.getOrderItems(o.id); // This will be implemented next
    const paymentRecords = await this.getPayments(o.id); // This will be implemented next

    return {
      ...o,
      items,
      payments: paymentRecords,
      createdByUser: o.createdByUser?.id ? o.createdByUser : undefined,
      managedByUser: o.managedByUser?.id ? o.managedByUser : undefined,
    } as OrderWithDetails;
  }
  async createOrder(orderPayload: InsertOrderApiPayload): Promise<Order> {
    return db.transaction(async (tx) => {
      const { items, ...orderData } = orderPayload;

      // Generate a unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // 1. Create the main order record
      const [newOrder] = await tx.insert(orders).values({
        ...orderData,
        orderNumber: orderNumber, // Provide the generated orderNumber
        updatedAt: new Date(),    // Set updatedAt timestamp
      }).returning();

      if (!newOrder) {
        throw new Error("Failed to create order record.");
      }

      // 2. Create order items
      if (items && items.length > 0) {
        const orderItemsData = items.map((item: z.infer<typeof apiOrderItemSchema>) => ({ // Explicitly type item using the imported schema
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice), // Ensure string format for TEXT column
          totalPrice: String(item.totalPrice), // Ensure string format for TEXT column
          modifications: item.modifications ? item.modifications : null, // Already string | null
          specialInstructions: item.specialInstructions,
        }));
        await tx.insert(orderItems).values(orderItemsData);
      }
      return newOrder;
    });
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    // Use Partial<typeof orders.$inferInsert> to allow setting updatedAt
    const dataToUpdate: Partial<typeof orders.$inferInsert> = {
      ...orderData,
      updatedAt: new Date()
    };
    const [updatedOrder] = await db.update(orders).set(dataToUpdate).where(eq(orders.id, id)).returning();
    return updatedOrder;
  }

  async updateOrderStatus(id: number, status: string, managedBy?: number): Promise<Order | undefined> {
    const updateData: Partial<typeof orders.$inferInsert> = {
      status,
      updatedAt: new Date()
    };
    if (managedBy !== undefined) {
      updateData.managedBy = managedBy;
    }
    const [updatedOrder] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return updatedOrder;
  }

  // Order Item methods
  async createOrderItem(orderItemData: SharedInsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db.insert(orderItems).values(orderItemData).returning();
    return newOrderItem;
  }

  async updateOrderItem(id: number, orderItemData: Partial<SharedInsertOrderItem>): Promise<OrderItem | undefined> {
    const [updatedOrderItem] = await db.update(orderItems).set(orderItemData).where(eq(orderItems.id, id)).returning();
    return updatedOrderItem;
  }

  async deleteOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.id, id)).returning({ id: orderItems.id });
    return result.length > 0;
  }

  async compOrderItem(id: number, compedByUserId: number, reason: string): Promise<OrderItem | undefined> {
    const updateData = {
      isComped: true,
      compedBy: compedByUserId,
      compReason: reason,
    };
    const [compedItem] = await db.update(orderItems).set(updateData).where(eq(orderItems.id, id)).returning();
    return compedItem;
  }

  async getOrderItems(orderIdToFetch: number): Promise<(OrderItem & { product: Product })[]> {
    const result = await db.select({
      // OrderItem fields
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      modifications: orderItems.modifications,
      specialInstructions: orderItems.specialInstructions,
      isComped: orderItems.isComped,
      compedBy: orderItems.compedBy,
      compReason: orderItems.compReason,
      // Product fields (all columns from products table)
      product: products,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderIdToFetch));
    
    // Drizzle returns the joined product table as a nested object named 'product'.
    // The structure should already match (OrderItem & { product: Product })
    return result as (OrderItem & { product: Product })[];
  }

  // Payment methods
  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(paymentData).returning();
    return newPayment;
  }

  async getPayments(orderIdToFetch: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.orderId, orderIdToFetch));
  }

  async processRefund(originalPaymentId: number, refundAmount: number, processedByUserId: number): Promise<Payment> {
    // Fetch the original payment to get orderId and paymentMethod
    const originalPayment = await db.select().from(payments).where(eq(payments.id, originalPaymentId)).limit(1);
    if (originalPayment.length === 0) {
      throw new Error(`Original payment with ID ${originalPaymentId} not found.`);
    }

    const refundData: InsertPayment = {
      orderId: originalPayment[0].orderId,
      paymentMethod: originalPayment[0].paymentMethod, // Or a specific 'refund' method
      amount: String(-Math.abs(refundAmount)), // Ensure amount is negative
      status: "refunded", // Or a specific status for refunds
      processedBy: processedByUserId,
      // stripePaymentId might be relevant if refunding via Stripe API, not handled here
      // createdAt is handled by default in schema, no need to be explicit for InsertPayment
    };
    const [newRefundPayment] = await db.insert(payments).values(refundData).returning();
    return newRefundPayment;
  }

  // Discount methods
  async getDiscounts(): Promise<Discount[]> {
    return db.select().from(discounts).where(eq(discounts.isActive, true)).orderBy(asc(discounts.name));
  }

  async createDiscount(discountData: InsertDiscount): Promise<Discount> {
    const [newDiscount] = await db.insert(discounts).values(discountData).returning();
    return newDiscount;
  }

  async updateDiscount(id: number, discountData: Partial<InsertDiscount>): Promise<Discount | undefined> {
    const [updatedDiscount] = await db.update(discounts).set(discountData).where(eq(discounts.id, id)).returning();
    return updatedDiscount;
  }

  async deleteDiscount(id: number): Promise<boolean> {
    // Consider if discounts are tied to orders; for now, direct deletion.
    // Alternatively, could set isActive to false.
    const result = await db.delete(discounts).where(eq(discounts.id, id)).returning({ id: discounts.id });
    return result.length > 0;
  }

  // Tax Rate methods
  async getTaxRates(): Promise<TaxRate[]> {
    return db.select().from(taxRates).where(eq(taxRates.isActive, true)).orderBy(asc(taxRates.name));
  }

  async getDefaultTaxRate(): Promise<TaxRate | undefined> {
    const result = await db.select().from(taxRates).where(and(eq(taxRates.isDefault, true), eq(taxRates.isActive, true))).limit(1);
    return result[0];
  }

  async createTaxRate(taxRateData: InsertTaxRate): Promise<TaxRate> {
    const [newTaxRate] = await db.insert(taxRates).values(taxRateData).returning();
    return newTaxRate;
  }

  async updateTaxRate(id: number, taxRateData: Partial<InsertTaxRate>): Promise<TaxRate | undefined> {
    const [updatedTaxRate] = await db.update(taxRates).set(taxRateData).where(eq(taxRates.id, id)).returning();
    return updatedTaxRate;
  }

  // Audit Log methods
  async createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(logData).returning();
    return newLog;
  }

  async getAuditLogs(entityType?: string, entityId?: number): Promise<AuditLog[]> {
    const conditions = [];
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }
    if (entityId !== undefined) {
      conditions.push(eq(auditLogs.entityId, entityId));
    }

    // Start with a base query
    let queryBuilder = db.select().from(auditLogs);

    // Apply the where clause with all conditions
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions)) as typeof queryBuilder;
    }
    
    // Finally, apply orderBy and execute
    return queryBuilder.orderBy(desc(auditLogs.createdAt));
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0];
  }

  async setSetting(key: string, value: string, categoryVal?: string, descriptionVal?: string): Promise<Setting> {
    const settingData: InsertSetting = { key, value };
    if (categoryVal) settingData.category = categoryVal;
    if (descriptionVal) settingData.description = descriptionVal;

    // Try to insert, and on conflict (unique key constraint), update.
    const [resultSet] = await db.insert(settings)
      .values(settingData)
      .onConflictDoUpdate({ target: settings.key, set: { value, category: categoryVal, description: descriptionVal } })
      .returning();
    return resultSet;
  }

  async getSettings(categoryVal?: string): Promise<Setting[]> {
    if (categoryVal) {
      return db.select().from(settings).where(eq(settings.category, categoryVal)).orderBy(asc(settings.key));
    }
    return db.select().from(settings).orderBy(asc(settings.category), asc(settings.key));
  }

  // Reports and Stats
  async getTodayStats(): Promise<{
    todaySales: number;
    todayOrders: number;
    lowStockCount: number;
    activeProductCount: number;
    todayTips: number;
    averageOrderValue: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const salesResult = await db.select({
        totalSales: sum(sql<number>`cast(${orders.total} as real)`),
        totalTips: sum(sql<number>`cast(${orders.tipAmount} as real)`),
        orderCount: count(orders.id)
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, todayStart),
        lte(orders.createdAt, todayEnd),
        eq(orders.status, "completed")
      ));

    const todaySales = Number(salesResult[0]?.totalSales) || 0;
    const todayTips = Number(salesResult[0]?.totalTips) || 0;
    const todayOrderCount = Number(salesResult[0]?.orderCount) || 0;

    const lowStockResult = await db.select({ count: count() })
      .from(products)
      .where(sql`${products.stock} <= ${products.minStock}`);
    const lowStockCount = Number(lowStockResult[0]?.count) || 0;

    const activeProductResult = await db.select({ count: count() })
      .from(products)
      .where(eq(products.isActive, true));
    const activeProductCount = Number(activeProductResult[0]?.count) || 0;
    
    const averageOrderValue = todayOrderCount > 0 ? todaySales / todayOrderCount : 0;

    return {
      todaySales,
      todayOrders: todayOrderCount,
      lowStockCount,
      activeProductCount,
      todayTips,
      averageOrderValue
    };
  }

  async getSalesReport(startDate: Date, endDate: Date): Promise<any> {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.select({
        totalSales: sum(sql<number>`cast(${orders.total} as real)`),
        totalTips: sum(sql<number>`cast(${orders.tipAmount} as real)`),
        orderCount: count(orders.id)
      })
      .from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endOfDay),
        eq(orders.status, "completed")
      ));

    const totalSales = Number(result[0]?.totalSales) || 0;
    const totalTips = Number(result[0]?.totalTips) || 0;
    const orderCount = Number(result[0]?.orderCount) || 0;
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
    
    // Fetch individual orders for the report if needed
    const detailedOrders = await db.select().from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endOfDay),
        eq(orders.status, "completed")
      )).orderBy(desc(orders.createdAt));

    return {
      period: { startDate, endDate },
      totalSales,
      totalTips,
      totalOrders: orderCount,
      averageOrderValue,
      orders: detailedOrders // Or a summary if full details are too much
    };
  }

  async getEmployeeReport(employeeId?: number, startDate?: Date, endDate?: Date): Promise<any> {
    const conditions = [];
    if (employeeId !== undefined) {
      conditions.push(eq(timeClockEvents.userId, employeeId));
    }
    if (startDate) {
      conditions.push(gte(timeClockEvents.eventTime, startDate));
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(timeClockEvents.eventTime, endOfDay));
    }
    
    const clockEvents = await db.select()
      .from(timeClockEvents)
      .where(and(...conditions))
      .orderBy(desc(timeClockEvents.eventTime));
      
    // This part needs to be recalculated based on events
    const totalHours = 0; // Placeholder

    return {
      employeeId,
      period: { startDate, endDate },
      totalHours,
      timeClockEvents: clockEvents
    };
  }
}


// Old MemStorage class - will be removed or heavily refactored/deleted
// For now, keeping it to avoid breaking existing code that might still use it,
// but the goal is to replace its usage entirely with DbStorage.
class MemStorage implements IStorage {
  // MemStorage is now mostly a stub and will have issues if used extensively.
  // It's kept to satisfy the IStorage interface during transition.
  private users: Map<number, UserWithRoles>;
  private appRoles: Map<number, AppRole>; // Added for MemStorage
  private userAppRoles: Map<string, UserAppRole>; // Key: "userId-roleId"
  private timeClockEvents: Map<number, TimeClockEvent>;
  private categories: Map<number, Category>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private payments: Map<number, Payment>;
  private discounts: Map<number, Discount>;
  private taxRates: Map<number, TaxRate>;
  private auditLogs: Map<number, AuditLog>;
  private settingsMap: Map<string, Setting>;
  private currentId: number;
  private lastOrderNumberSuffix: number; // Added for sequential order numbers

  constructor() {
    this.users = new Map();
    this.appRoles = new Map();
    this.userAppRoles = new Map();
    this.timeClockEvents = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.payments = new Map();
    this.discounts = new Map();
    this.taxRates = new Map();
    this.auditLogs = new Map();
    this.settingsMap = new Map();
    this.currentId = 1;
    this.lastOrderNumberSuffix = 0; // Initialize suffix
    
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default admin user
    const adminUser: UserWithRoles = {
      id: 1,
      employeeCode: "00001", // Changed from username
      email: "admin@vendorpos.com",
      pinHash: "$2b$10$hashedpassword", // Changed from passwordHash
      firstName: "Admin",
      lastName: "User",
      // role: "admin", // Roles are now separate
      isActive: true,
      hourlyRate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [{id: 99, name: "Admin (MemStorage)", description: "MemStorage Admin", category: "management_hybrid"}] // Simulated role
    };
    this.users.set(1, adminUser);

    // Create default manager
    const managerUser: UserWithRoles = {
      id: 2,
      employeeCode: "12345", // Changed from username, matches seed
      email: "manager@vendorpos.com",
      pinHash: "$2b$10$hashedpassword", // Changed from passwordHash, seed script handles actual hashing
      firstName: "Manager",
      lastName: "User",
      // role: "manager",
      isActive: true,
      hourlyRate: "25.00",
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [{id: 100, name: "General Manager (GM) / Store Manager (MemStorage)", description: "MemStorage GM", category: "management_hybrid"}] // Simulated role
    };
    this.users.set(2, managerUser);

    // Create default employee
    const employeeUser: UserWithRoles = {
      id: 3,
      employeeCode: "00003", // Changed from username
      email: "employee@vendorpos.com",
      pinHash: "$2b$10$hashedpassword", // Changed from passwordHash
      firstName: "Employee",
      lastName: "User",
      // role: "employee",
      isActive: true,
      hourlyRate: "15.00",
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [{id: 101, name: "Server / Waiter / Waitress (MemStorage)", description: "MemStorage Server", category: "front_of_house_restaurant"}] // Simulated role
    };
    this.users.set(3, employeeUser);

    // Create default categories
    const defaultCategories: Category[] = [
      { id: 1, name: "Beverages", description: "Hot and cold beverages", sortOrder: 1, isActive: true },
      { id: 2, name: "Food", description: "Main food items", sortOrder: 2, isActive: true },
      { id: 3, name: "Services", description: "Professional services", sortOrder: 3, isActive: true },
      { id: 4, name: "Digital", description: "Digital products and services", sortOrder: 4, isActive: true }
    ];
    
    defaultCategories.forEach(cat => {
      this.categories.set(cat.id, cat);
    });

    // Create default products with modifications
    const defaultProducts: Product[] = [
      {
        id: 1,
        name: "Premium Coffee",
        description: "Rich blend of arabica beans",
        price: "4.99",
        categoryId: 1,
        imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "COF001",
        stock: 12,
        minStock: 5,
        maxStock: 50,
        isActive: true,
        hasSizes: true,
        allowModifications: true,
        itemType: "product",
        requiresInventory: true,
        taxable: true,
        serviceDetails: null,
        modificationOptions: [
          { id: "size-small", name: "Small", category: "size", price: 0 },
          { id: "size-medium", name: "Medium", category: "size", price: 0.50 },
          { id: "size-large", name: "Large", category: "size", price: 1.00 },
          { id: "milk-regular", name: "Regular Milk", category: "milk", price: 0 },
          { id: "milk-oat", name: "Oat Milk", category: "milk", price: 0.75 },
          { id: "milk-almond", name: "Almond Milk", category: "milk", price: 0.75 }
        ],
        createdAt: new Date()
      },
      {
        id: 2,
        name: "Gourmet Sandwich",
        description: "Turkey, avocado, swiss cheese",
        price: "8.99",
        categoryId: 2,
        imageUrl: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "SAN001",
        stock: 5,
        minStock: 8,
        maxStock: 30,
        isActive: true,
        hasSizes: false,
        allowModifications: true,
        itemType: "product",
        requiresInventory: true,
        taxable: true,
        serviceDetails: null,
        modificationOptions: [
          { id: "bread-white", name: "White Bread", category: "bread", price: 0 },
          { id: "bread-wheat", name: "Wheat Bread", category: "bread", price: 0 },
          { id: "bread-sourdough", name: "Sourdough", category: "bread", price: 0.50 },
          { id: "extra-bacon", name: "Extra Bacon", category: "extras", price: 2.00 },
          { id: "extra-cheese", name: "Extra Cheese", category: "extras", price: 1.50 }
        ],
        createdAt: new Date()
      }
    ];

    defaultProducts.forEach(product => {
      this.products.set(product.id, product);
    });

    // Create default tax rates
    const defaultTaxRate: TaxRate = {
      id: 1,
      name: "Standard Tax",
      rate: "0.0825",
      isDefault: true,
      isActive: true
    };
    this.taxRates.set(1, defaultTaxRate);

    // Create default discounts
    const defaultDiscounts: Discount[] = [
      {
        id: 1,
        name: "Employee Discount",
        type: "percentage",
        value: "10.00",
        isActive: true,
        requiresManager: false,
        createdAt: new Date()
      },
      {
        id: 2,
        name: "Manager Override",
        type: "percentage",
        value: "50.00",
        isActive: true,
        requiresManager: true,
        createdAt: new Date()
      }
    ];

    defaultDiscounts.forEach(discount => {
      this.discounts.set(discount.id, discount);
    });

    // Initialize default settings
    const defaultSettings = [
      { key: "store_name", value: "Main Location", category: "general", description: "Store name" },
      { key: "tax_rate", value: "8.25", category: "general", description: "Default tax rate percentage" },
      { key: "currency", value: "USD", category: "general", description: "Default currency" },
      { key: "timezone", value: "America/New_York", category: "general", description: "Store timezone" },
      { key: "tips_enabled", value: "true", category: "payments", description: "Enable tip collection" },
      { key: "tip_suggestions", value: "15,18,20,25", category: "payments", description: "Default tip percentages" },
      { key: "split_payments_enabled", value: "true", category: "payments", description: "Allow split payments" },
      { key: "manager_override_required", value: "true", category: "security", description: "Require manager for refunds/comps" },
      { key: "held_orders_require_manager", value: "false", category: "orders", description: "Require manager to access held orders" }
    ];

    defaultSettings.forEach(setting => {
      this.settingsMap.set(setting.key, { 
        id: this.currentId++, 
        key: setting.key,
        value: setting.value,
        category: setting.category,
        description: setting.description
      });
    });

    this.currentId = 100; // Start IDs from 100 to avoid conflicts
  }

  // User methods
  async getUsers(): Promise<UserWithTimeClock[]> {
    const usersArray = Array.from(this.users.values());
    const result: UserWithTimeClock[] = [];
    for (const user of usersArray) {
        const timeClockEvents = await this.getTimeClockEvents(user.id);
        result.push({
            ...user, // UserWithRoles
            timeClockEvents,
        });
    }
    return result;
  }

  async getUser(id: number): Promise<UserWithRoles | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    return {...user}; // Returns UserWithRoles
  }
  
  async getUserByEmployeeCode(employeeCode: string): Promise<UserWithRoles | undefined> {
    // Simulate fetching by employee code for MemStorage
    return Array.from(this.users.values()).find(user => user.employeeCode === employeeCode);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // This method is problematic with the new schema (employeeCode is primary identifier).
    // For MemStorage, let's assume it tries to find by email if username was meant as a unique identifier.
    console.warn("MemStorage.getUserByUsername is deprecated and behavior might be unexpected. Trying to match by email.");
    const userWithRoles = Array.from(this.users.values()).find(user => user.email === username);
    if (userWithRoles) {
      // Strip roles to match original User | undefined signature if needed, though IStorage might evolve this.
      // For now, let's return the User part.
      const { roles, ...userBase } = userWithRoles;
      return userBase as User;
    }
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentId++;
    // Ensure InsertUser aligns with User schema (employeeCode, pinHash, no role)
    const newUser: UserWithRoles = {
      id,
      employeeCode: user.employeeCode,
      email: user.email || null,
      pinHash: user.pinHash || null, // pinHash is optional
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      isActive: user.isActive !== undefined ? user.isActive : true,
      hourlyRate: user.hourlyRate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [] // New users in MemStorage start with no roles unless explicitly added
    };
    this.users.set(id, newUser);
    // Return type is User, so strip roles for now if strict adherence is needed.
    const { roles, ...userBase } = newUser;
    return userBase as User;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    const updatedUser: UserWithRoles = {
        ...existing,
        ...(user.employeeCode && { employeeCode: user.employeeCode }),
        ...(user.email && { email: user.email }),
        ...(user.pinHash && { pinHash: user.pinHash }),
        ...(user.firstName && { firstName: user.firstName }),
        ...(user.lastName && { lastName: user.lastName }),
        ...(user.isActive !== undefined && { isActive: user.isActive }),
        ...(user.hourlyRate && { hourlyRate: user.hourlyRate }),
        updatedAt: new Date(),
        // roles are not updated here for MemStorage
    };
    
    this.users.set(id, updatedUser);
    const { roles, ...userBase } = updatedUser;
    return userBase as User;
  }

  // MemStorage AppRoles stubs
  async getAppRoles(): Promise<AppRole[]> { return Array.from(this.appRoles.values()); }
  async getAppRole(id: number): Promise<AppRole | undefined> { return this.appRoles.get(id); }
  async createAppRole(roleData: InsertAppRole): Promise<AppRole> {
    const id = this.currentId++;
    const newRole: AppRole = {
      id,
      name: roleData.name,
      description: roleData.description === undefined ? null : roleData.description,
      category: roleData.category === undefined ? null : roleData.category,
    };
    this.appRoles.set(id, newRole);
    return newRole;
  }
  async updateAppRole(id: number, roleData: Partial<InsertAppRole>): Promise<AppRole | undefined> {
    const existing = this.appRoles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...roleData };
    this.appRoles.set(id, updated);
    return updated;
  }
  async deleteAppRole(id: number): Promise<boolean> {
    // Also remove from userAppRoles
    Array.from(this.userAppRoles.entries()).forEach(([key, val]) => {
      if (val.roleId === id) this.userAppRoles.delete(key);
    });
    return this.appRoles.delete(id);
  }

  // MemStorage UserAppRoles stubs
  async assignRoleToUser(userId: number, roleId: number): Promise<UserAppRole> {
    const assignment: UserAppRole = { userId, roleId };
    this.userAppRoles.set(`${userId}-${roleId}`, assignment);
    // Add to user's roles array in MemStorage
    const user = this.users.get(userId);
    const role = this.appRoles.get(roleId);
    if (user && role && !user.roles.find(r => r.id === roleId)) {
      user.roles.push(role);
    }
    return assignment;
  }
  async removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    // Remove from user's roles array in MemStorage
    const user = this.users.get(userId);
    if (user) {
      user.roles = user.roles.filter(r => r.id !== roleId);
    }
    return this.userAppRoles.delete(`${userId}-${roleId}`);
  }
  async getUserRoles(userId: number): Promise<AppRole[]> {
    const user = this.users.get(userId);
    return user?.roles || [];
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Time Clock methods
  async createTimeClockEvent(userId: number, eventType: "clock-in" | "clock-out" | "break-start" | "break-end"): Promise<TimeClockEvent> {
    const id = this.currentId++;
    const now = new Date();
    const newEvent: TimeClockEvent = {
      id,
      userId,
      eventType,
      eventTime: now,
      createdAt: now,
    };
    this.timeClockEvents.set(id, newEvent);
    return newEvent;
  }

  async getLatestTimeClockEvent(userId: number): Promise<TimeClockEvent | undefined> {
    return Array.from(this.timeClockEvents.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())[0];
  }

  async getTimeClockEvents(userId: number, startDate?: Date, endDate?: Date): Promise<TimeClockEvent[]> {
    let events = Array.from(this.timeClockEvents.values())
      .filter(e => e.userId === userId);

    if (startDate) {
      events = events.filter(e => e.eventTime >= startDate);
    }

    if (endDate) {
      events = events.filter(e => e.eventTime <= endDate);
    }

    return events.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter(cat => cat.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.currentId++;
    const newCategory: Category = { 
      id, 
      name: category.name, 
      description: category.description || null,
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive !== false
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const existing = this.categories.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...category };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Product methods
  async getProducts(): Promise<ProductWithCategory[]> {
    const productsArray = Array.from(this.products.values());
    return productsArray.map(product => {
      const mods = product.modificationOptions as ProductModification[] | undefined | null;
      return {
        ...product,
        category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
        modificationOptions: mods || null
      };
    }) as ProductWithCategory[]; // Cast the whole result
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const mods = product.modificationOptions as ProductModification[] | undefined | null;
    return {
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
      modificationOptions: mods || null
    } as ProductWithCategory; // Cast the whole result
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentId++;
    const newProduct: Product = { 
      id, 
      name: product.name,
      description: product.description || null,
      price: product.price,
      categoryId: product.categoryId || null,
      imageUrl: product.imageUrl || null,
      sku: product.sku,
      stock: product.stock || 0,
      minStock: product.minStock || null,
      maxStock: product.maxStock || null,
      isActive: product.isActive !== false,
      hasSizes: product.hasSizes || false,
      allowModifications: product.allowModifications !== false,
      modificationOptions: product.modificationOptions || null,
      itemType: product.itemType || "product",
      requiresInventory: product.requiresInventory !== false,
      taxable: product.taxable !== false,
      serviceDetails: product.serviceDetails || null,
      createdAt: new Date()
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...product };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  async updateProductStock(id: number, stock: number): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    product.stock = stock;
    this.products.set(id, product);
    return product;
  }

  // Order methods
  async getOrders(filters?: { status?: string }): Promise<OrderWithDetails[]> {
    let ordersArray = Array.from(this.orders.values());

    if (filters?.status) {
      ordersArray = ordersArray.filter(order => order.status === filters.status);
    }

    const ordersWithDetails: OrderWithDetails[] = [];

    for (const order of ordersArray) {
      const items = await this.getOrderItems(order.id);
      const payments = await this.getPayments(order.id);
      const createdByUser = order.createdBy ? this.users.get(order.createdBy) : undefined;
      const managedByUser = order.managedBy ? this.users.get(order.managedBy) : undefined;
      
      ordersWithDetails.push({ 
        ...order, 
        items, 
        payments,
        createdByUser,
        managedByUser
      });
    }

    return ordersWithDetails.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const items = await this.getOrderItems(id);
    const payments = await this.getPayments(id);
    const createdByUser = order.createdBy ? this.users.get(order.createdBy) : undefined;
    const managedByUser = order.managedBy ? this.users.get(order.managedBy) : undefined;
    
    return { 
      ...order, 
      items, 
      payments,
      createdByUser,
      managedByUser
    };
  }

  async createOrder(order: InsertOrderApiPayload): Promise<Order> { // Modified parameter type
    const id = this.currentId++;
    this.lastOrderNumberSuffix++; // Increment for a new order
    const orderNumber = `ORD-${String(this.lastOrderNumberSuffix).padStart(6, '0')}`; // Generate sequential number
    const newOrder: Order = {
      id,
      orderNumber, // Use server-generated number
      customerName: order.customerName || null,
      customerPhone: order.customerPhone || null,
      customerEmail: order.customerEmail || null,
      subtotal: order.subtotal,
      tax: order.tax,
      tipAmount: order.tipAmount || "0.00",
      discountAmount: order.discountAmount || "0.00",
      total: order.total,
      status: order.status || "pending",
      orderType: order.orderType || "dine-in",
      tableNumber: order.tableNumber || null,
      notes: order.notes || null,
      createdBy: order.createdBy || null,
      managedBy: order.managedBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...order, updatedAt: new Date() };
    this.orders.set(id, updated);
    return updated;
  }

  async updateOrderStatus(id: number, status: string, managedBy?: number): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    order.status = status;
    order.updatedAt = new Date();
    if (managedBy) {
      order.managedBy = managedBy;
    }
    
    this.orders.set(id, order);
    return order;
  }

  // Order Item methods
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentId++;
    const newOrderItem: OrderItem = { 
      id,
      orderId: orderItem.orderId,
      productId: orderItem.productId,
      quantity: orderItem.quantity,
      unitPrice: orderItem.unitPrice,
      totalPrice: orderItem.totalPrice,
      modifications: orderItem.modifications || null,
      specialInstructions: orderItem.specialInstructions || null,
      isComped: orderItem.isComped || false,
      compedBy: orderItem.compedBy || null,
      compReason: orderItem.compReason || null
    };
    this.orderItems.set(id, newOrderItem);
    return newOrderItem;
  }

  async updateOrderItem(id: number, orderItem: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const existing = this.orderItems.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...orderItem };
    this.orderItems.set(id, updated);
    return updated;
  }

  async deleteOrderItem(id: number): Promise<boolean> {
    return this.orderItems.delete(id);
  }

  async compOrderItem(id: number, compedBy: number, reason: string): Promise<OrderItem | undefined> {
    const item = this.orderItems.get(id);
    if (!item) return undefined;

    item.isComped = true;
    item.compedBy = compedBy;
    item.compReason = reason;
    
    this.orderItems.set(id, item);
    return item;
  }

  async getOrderItems(orderId: number): Promise<(OrderItem & { product: Product })[]> {
    const items = Array.from(this.orderItems.values())
      .filter(item => item.orderId === orderId);
    
    return items.map(item => ({
      ...item,
      product: this.products.get(item.productId)!
    }));
  }

  // Payment methods
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = this.currentId++;
    const newPayment: Payment = {
      id,
      orderId: payment.orderId,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      stripePaymentId: payment.stripePaymentId || null,
      cashReceived: payment.cashReceived || null,
      changeGiven: payment.changeGiven || null,
      status: payment.status || "completed",
      processedBy: payment.processedBy || null,
      createdAt: new Date()
    };
    this.payments.set(id, newPayment);
    return newPayment;
  }

  async getPayments(orderId: number): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(payment => payment.orderId === orderId);
  }

  async processRefund(paymentId: number, amount: number, processedBy: number): Promise<Payment> {
    const id = this.currentId++;
    const originalPayment = this.payments.get(paymentId);
    
    const refundPayment: Payment = {
      id,
      orderId: originalPayment?.orderId || 0,
      paymentMethod: originalPayment?.paymentMethod || "card",
      amount: `-${amount}`,
      stripePaymentId: null,
      cashReceived: null,
      changeGiven: null,
      status: "completed",
      processedBy,
      createdAt: new Date()
    };
    
    this.payments.set(id, refundPayment);
    return refundPayment;
  }

  // Discount methods
  async getDiscounts(): Promise<Discount[]> {
    return Array.from(this.discounts.values())
      .filter(discount => discount.isActive);
  }

  async createDiscount(discount: InsertDiscount): Promise<Discount> {
    const id = this.currentId++;
    const newDiscount: Discount = {
      id,
      name: discount.name,
      type: discount.type,
      value: discount.value,
      isActive: discount.isActive !== false,
      requiresManager: discount.requiresManager || false,
      createdAt: new Date()
    };
    this.discounts.set(id, newDiscount);
    return newDiscount;
  }

  async updateDiscount(id: number, discount: Partial<InsertDiscount>): Promise<Discount | undefined> {
    const existing = this.discounts.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...discount };
    this.discounts.set(id, updated);
    return updated;
  }

  async deleteDiscount(id: number): Promise<boolean> {
    return this.discounts.delete(id);
  }

  // Tax Rate methods
  async getTaxRates(): Promise<TaxRate[]> {
    return Array.from(this.taxRates.values())
      .filter(rate => rate.isActive);
  }

  async getDefaultTaxRate(): Promise<TaxRate | undefined> {
    return Array.from(this.taxRates.values())
      .find(rate => rate.isDefault && rate.isActive);
  }

  async createTaxRate(taxRate: InsertTaxRate): Promise<TaxRate> {
    const id = this.currentId++;
    const newTaxRate: TaxRate = {
      id,
      name: taxRate.name,
      rate: taxRate.rate,
      isDefault: taxRate.isDefault || false,
      isActive: taxRate.isActive !== false
    };
    this.taxRates.set(id, newTaxRate);
    return newTaxRate;
  }

  async updateTaxRate(id: number, taxRate: Partial<InsertTaxRate>): Promise<TaxRate | undefined> {
    const existing = this.taxRates.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...taxRate };
    this.taxRates.set(id, updated);
    return updated;
  }

  // Audit Log methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.currentId++;
    const newLog: AuditLog = {
      id,
      userId: log.userId || null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || null,
      oldValues: log.oldValues || null,
      newValues: log.newValues || null,
      reason: log.reason || null,
      createdAt: new Date()
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }

  async getAuditLogs(entityType?: string, entityId?: number): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    
    if (entityType) {
      logs = logs.filter(log => log.entityType === entityType);
    }
    
    if (entityId) {
      logs = logs.filter(log => log.entityId === entityId);
    }
    
    return logs.sort((a, b) => (b.createdAt || new Date()).getTime() - (a.createdAt || new Date()).getTime());
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settingsMap.get(key);
  }

  async setSetting(key: string, value: string, category?: string, description?: string): Promise<Setting> {
    const existing = this.settingsMap.get(key);
    if (existing) {
      existing.value = value;
      if (category) existing.category = category;
      if (description) existing.description = description;
      this.settingsMap.set(key, existing);
      return existing;
    } else {
      const id = this.currentId++;
      const newSetting: Setting = { 
        id, 
        key, 
        value,
        category: category || "general",
        description: description || null
      };
      this.settingsMap.set(key, newSetting);
      return newSetting;
    }
  }

  async getSettings(category?: string): Promise<Setting[]> {
    const settings = Array.from(this.settingsMap.values());
    if (category) {
      return settings.filter(setting => setting.category === category);
    }
    return settings;
  }

  // Reports and Stats
  async getTodayStats(): Promise<{
    todaySales: number;
    todayOrders: number;
    lowStockCount: number;
    activeProductCount: number;
    todayTips: number;
    averageOrderValue: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = Array.from(this.orders.values())
      .filter(order => {
        const orderDate = new Date(order.createdAt!);
        return orderDate >= today && order.status === "completed";
      });

    const todaySales = todayOrders.reduce((sum, order) => 
      sum + parseFloat(order.total), 0
    );

    const todayTips = todayOrders.reduce((sum, order) => 
      sum + parseFloat(order.tipAmount || "0"), 0
    );

    const lowStockCount = Array.from(this.products.values())
      .filter(product => product.stock <= (product.minStock || 5)).length;

    const activeProductCount = Array.from(this.products.values())
      .filter(product => product.isActive).length;

    const averageOrderValue = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;

    return {
      todaySales,
      todayOrders: todayOrders.length,
      lowStockCount,
      activeProductCount,
      todayTips,
      averageOrderValue
    };
  }

  async getSalesReport(startDate: Date, endDate: Date): Promise<any> {
    const orders = Array.from(this.orders.values())
      .filter(order => {
        const orderDate = new Date(order.createdAt!);
        return orderDate >= startDate && orderDate <= endDate && order.status === "completed";
      });

    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalTips = orders.reduce((sum, order) => sum + parseFloat(order.tipAmount || "0"), 0);
    const averageOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

    return {
      period: { startDate, endDate },
      totalSales,
      totalTips,
      totalOrders: orders.length,
      averageOrderValue,
      orders
    };
  }

  async getEmployeeReport(userId?: number, startDate?: Date, endDate?: Date): Promise<any> {
    let timeClockEvents = Array.from(this.timeClockEvents.values());
    
    if (userId) {
      timeClockEvents = timeClockEvents.filter(tc => tc.userId === userId);
    }
    
    if (startDate) {
      timeClockEvents = timeClockEvents.filter(tc => tc.eventTime >= startDate);
    }
    
    if (endDate) {
      timeClockEvents = timeClockEvents.filter(tc => tc.eventTime <= endDate);
    }

    const totalHours = 0; // Placeholder
    
    return {
      userId,
      period: { startDate, endDate },
      totalHours,
      timeClockEvents: timeClockEvents.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
    };
  }
}

// export const storage = new MemStorage(); // Comment out old MemStorage
export const storage = new DbStorage(); // Use DbStorage
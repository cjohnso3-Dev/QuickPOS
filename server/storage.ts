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
    
    // Fetch events in ascending order for chronological processing
    const clockEvents = await db.select()
      .from(timeClockEvents)
      .where(and(...conditions))
      .orderBy(asc(timeClockEvents.eventTime));
      
    let totalWorkMillis = 0;
    let totalBreakMillis = 0;
    let currentClockInTime: Date | null = null;
    let onBreak = false;
    let breakStartTime: Date | null = null;

    for (const event of clockEvents) {
      const eventTime = new Date(event.eventTime); // Ensure eventTime is a Date object

      switch (event.eventType) {
        case 'clock-in':
          if (!currentClockInTime) { // Only clock in if not already clocked in
            currentClockInTime = eventTime;
            onBreak = false; // Reset break status on new clock-in
            breakStartTime = null;
          } else {
            // Handle data error: multiple clock-ins without clock-out
            console.warn(`Data Error: User ${employeeId} clocked in again at ${eventTime} without clocking out from ${currentClockInTime}.`);
            // Optionally, could treat this as a new session, effectively clocking out the previous one.
            // For now, we'll stick to the first clock-in.
          }
          break;
        case 'break-start':
          if (currentClockInTime && !onBreak) {
            breakStartTime = eventTime;
            onBreak = true;
          }
          break;
        case 'break-end':
          if (currentClockInTime && onBreak && breakStartTime) {
            totalBreakMillis += eventTime.getTime() - breakStartTime.getTime();
            onBreak = false;
            breakStartTime = null;
          }
          break;
        case 'clock-out':
          if (currentClockInTime) {
            let workSegmentMillis = eventTime.getTime() - currentClockInTime.getTime();

            if (onBreak && breakStartTime) {
              // If user clocked out while on break, end the break at clock-out time
              const currentBreakSegmentMillis = eventTime.getTime() - breakStartTime.getTime();
              totalBreakMillis += currentBreakSegmentMillis;
              onBreak = false;
              breakStartTime = null;
            }
            totalWorkMillis += workSegmentMillis;
            currentClockInTime = null; // Reset for next session
          } else {
            // Handle data error: clock-out without clock-in
             console.warn(`Data Error: User ${employeeId} clocked out at ${eventTime} without a corresponding clock-in.`);
          }
          break;
      }
    }

    // If employee is still clocked in at the end of the report period (or current time if endDate is future)
    if (currentClockInTime) {
      const periodEnd = (endDate && endDate < new Date()) ? new Date(endDate) : new Date();
      // Ensure periodEnd is not before currentClockInTime
      const effectiveEndTime = periodEnd > currentClockInTime ? periodEnd : currentClockInTime;

      let lastSegmentMillis = effectiveEndTime.getTime() - currentClockInTime.getTime();
      
      if (onBreak && breakStartTime) {
        // If still on break, calculate break time up to periodEnd
        const breakDurationMillis = effectiveEndTime.getTime() - breakStartTime.getTime();
        totalBreakMillis += breakDurationMillis;
      }
      totalWorkMillis += lastSegmentMillis;
    }
    
    const netWorkMillis = totalWorkMillis - totalBreakMillis;
    // Ensure netWorkMillis is not negative due to data errors or overlapping breaks.
    const totalHours = Math.max(0, netWorkMillis / (1000 * 60 * 60));

    return {
      employeeId,
      period: { startDate, endDate },
      totalHours,
      timeClockEvents: clockEvents
    };
  }
}

// export const storage = new MemStorage(); // Comment out old MemStorage
export const storage = new DbStorage(); // Use DbStorage
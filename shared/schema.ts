import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User management and roles
// Note: SQLite does not have a dedicated 'serial' type like PostgreSQL.
// 'integer primary key' in SQLite is auto-incrementing.
// 'decimal' is not a native SQLite type; it's often stored as REAL or TEXT. Drizzle handles this.
// 'timestamp' is stored as TEXT or INTEGER (unix epoch). Drizzle handles this.
// 'varchar' is TEXT in SQLite.
// 'json' is stored as TEXT in SQLite.
// 'boolean' is stored as INTEGER (0 or 1) in SQLite.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeCode: text("employee_code", { length: 5 }).notNull().unique(), // 5 digit employee code
  email: text("email", { length: 100 }).unique(),
  pinHash: text("pin_hash"), // Optional 4 digit pin, hashed
  firstName: text("first_name", { length: 50 }),
  lastName: text("last_name", { length: 50 }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  hourlyRate: text("hourly_rate"), // Stored as TEXT, Drizzle will handle conversion
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const appRoles = sqliteTable("app_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: text("category", { length: 100 }), // e.g. "front_of_house_restaurant"
});

export const userAppRoles = sqliteTable("user_app_roles", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: integer("role_id").references(() => appRoles.id, { onDelete: "cascade" }).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  };
});

export const timeClockEvents = sqliteTable("time_clock_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id).notNull(),
  eventType: text("event_type", { enum: ["clock-in", "clock-out", "break-start", "break-end"] }).notNull(),
  eventTime: integer("event_time", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price").notNull(), // Stored as TEXT
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: text("image_url"),
  sku: text("sku").notNull().unique(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").default(5),
  maxStock: integer("max_stock").default(100),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  hasSizes: integer("has_sizes", { mode: "boolean" }).default(false),
  allowModifications: integer("allow_modifications", { mode: "boolean" }).default(true),
  modificationOptions: text("modification_options", { mode: "json" }), // JSON array of modification options
  itemType: text("item_type", { length: 20 }).notNull().default("product"), // product, service, digital
  requiresInventory: integer("requires_inventory", { mode: "boolean" }).default(true), // false for services
  taxable: integer("taxable", { mode: "boolean" }).default(true),
  serviceDetails: text("service_details", { mode: "json" }), // duration, appointment required, etc.
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const productSizes = sqliteTable("product_sizes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  sizeName: text("size_name", { length: 50 }).notNull(), // sm, med, large
  sizeLabel: text("size_label", { length: 100 }).notNull(), // Small, Medium, Large
  price: text("price").notNull(), // Stored as TEXT
  priceModifier: text("price_modifier").default("0.00"), // +/- from base price, Stored as TEXT
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNumber: text("order_number", { length: 20 }).notNull().unique(),
  customerName: text("customer_name").default("Walk-in Customer"),
  customerPhone: text("customer_phone", { length: 20 }),
  customerEmail: text("customer_email", { length: 100 }),
  subtotal: text("subtotal").notNull(), // Stored as TEXT
  tax: text("tax").notNull(), // Stored as TEXT
  tipAmount: text("tip_amount").default("0.00"), // Stored as TEXT
  discountAmount: text("discount_amount").default("0.00"), // Stored as TEXT
  total: text("total").notNull(), // Stored as TEXT
  status: text("status").notNull().default("pending"), // pending, processing, completed, cancelled, refunded
  orderType: text("order_type", { length: 20 }).default("dine-in"), // dine-in, takeout, delivery
  tableNumber: text("table_number", { length: 10 }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  managedBy: integer("managed_by").references(() => users.id), // for overrides
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unit_price").notNull(), // Stored as TEXT
  totalPrice: text("total_price").notNull(), // Stored as TEXT
  modifications: text("modifications", { mode: "json" }), // JSON array of modifications
  specialInstructions: text("special_instructions"),
  isComped: integer("is_comped", { mode: "boolean" }).default(false),
  compedBy: integer("comped_by").references(() => users.id),
  compReason: text("comp_reason"),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  paymentMethod: text("payment_method", { length: 20 }).notNull(), // cash, card, split
  amount: text("amount").notNull(), // Stored as TEXT
  stripePaymentId: text("stripe_payment_id"),
  cashReceived: text("cash_received"), // Stored as TEXT
  changeGiven: text("change_given"), // Stored as TEXT
  status: text("status", { length: 20 }).default("completed"), // pending, completed, failed, refunded
  processedBy: integer("processed_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const discounts = sqliteTable("discounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { length: 100 }).notNull(),
  type: text("type", { length: 20 }).notNull(), // percentage, fixed_amount
  value: text("value").notNull(), // Stored as TEXT
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  requiresManager: integer("requires_manager", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const taxRates = sqliteTable("tax_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { length: 50 }).notNull(),
  rate: text("rate").notNull(), // e.g., 0.0825 for 8.25%, Stored as TEXT
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action", { length: 50 }).notNull(),
  entityType: text("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  oldValues: text("old_values", { mode: "json" }),
  newValues: text("new_values", { mode: "json" }),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).defaultNow(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category", { length: 50 }).default("general"),
  description: text("description"),
});

// Insert schemas
// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppRoleSchema = createInsertSchema(appRoles).omit({ id: true });
export const insertUserAppRoleSchema = createInsertSchema(userAppRoles);
export const insertTimeClockEventSchema = createInsertSchema(timeClockEvents).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });

// Product modification type
export type ProductModification = {
  id: string;
  name: string;
  category: string;
  price: number;
};
export const insertProductSizeSchema = createInsertSchema(productSizes).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });

// Schema for individual order items within an API payload
export const apiOrderItemSchema = z.object({
  productId: z.number(),
  quantity: z.number().min(1),
  unitPrice: z.string().refine(val => !isNaN(parseFloat(val)), { message: "Unit price must be a valid number string" }),
  totalPrice: z.string().refine(val => !isNaN(parseFloat(val)), { message: "Total price must be a valid number string" }),
  modifications: z.string().nullable().optional(), // Assuming JSON string, consistent with orderItems.modifications
  specialInstructions: z.string().nullable().optional(),
});

// Schema for API payload when creating an order, including items
export const insertOrderApiPayloadSchema = insertOrderSchema
  .omit({ orderNumber: true }) // orderNumber is server-generated
  .extend({
    items: z.array(apiOrderItemSchema).min(1, "Order must have at least one item."),
  });

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertDiscountSchema = createInsertSchema(discounts).omit({ id: true, createdAt: true });
export const insertTaxRateSchema = createInsertSchema(taxRates).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type AppRole = typeof appRoles.$inferSelect;
export type UserAppRole = typeof userAppRoles.$inferSelect;
export type TimeClockEvent = typeof timeClockEvents.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductSize = typeof productSizes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type TaxRate = typeof taxRates.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAppRole = z.infer<typeof insertAppRoleSchema>;
export type InsertUserAppRole = z.infer<typeof insertUserAppRoleSchema>;
export type InsertTimeClockEvent = z.infer<typeof insertTimeClockEventSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductSize = z.infer<typeof insertProductSizeSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderApiPayload = z.infer<typeof insertOrderApiPayloadSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Define a type for User with their roles, usable by both server and client
export type UserWithRoles = User & { roles: AppRole[] };

// Extended types for UI
export type UserWithTimeClock = UserWithRoles & { // UserWithTimeClock now extends UserWithRoles
  timeClockEvents?: TimeClockEvent[];
  todayHours?: number;
  todayBreakHours?: number; // Added for displaying total break hours today
  // roles are already in UserWithRoles
};

export type ProductWithCategory = Product & {
  category?: Category;
  // Ensure this matches the actual data structure after parsing.
  // The 'Product' type itself will have 'modificationOptions: string | null' (or parsed if Drizzle handles it)
  // This extended type should reflect the parsed structure.
  modificationOptions?: ProductModification[] | null;
};

export type OrderWithDetails = Order & {
  items: (OrderItem & { product: Product })[];
  payments: Payment[];
  createdByUser?: User;
  managedByUser?: User;
};

export type CartItem = {
  product: ProductWithCategory;
  quantity: number;
  modifications?: any[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
};

export type OrderModification = {
  id: string;
  name: string;
  price: number;
  category: string;
};

export type TipOption = {
  label: string;
  percentage?: number;
  amount?: number;
};

export type PaymentSplit = {
  method: 'cash' | 'card';
  amount: number;
  cardPaymentId?: string;
  cashReceived?: number;
  changeGiven?: number;
};

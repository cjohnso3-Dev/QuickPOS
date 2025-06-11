import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User management and roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 100 }).unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  role: varchar("role", { length: 20 }).notNull().default("employee"), // employee, manager, admin
  isActive: boolean("is_active").default(true),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timeClocks = pgTable("time_clocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  breakDuration: integer("break_duration").default(0), // minutes
  totalHours: decimal("total_hours", { precision: 8, scale: 2 }),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: text("image_url"),
  sku: text("sku").notNull().unique(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").default(5),
  maxStock: integer("max_stock").default(100),
  isActive: boolean("is_active").default(true),
  hasSizes: boolean("has_sizes").default(false),
  allowModifications: boolean("allow_modifications").default(true),
  modificationOptions: json("modification_options"), // JSON array of modification options
  itemType: varchar("item_type", { length: 20 }).notNull().default("product"), // product, service, digital
  requiresInventory: boolean("requires_inventory").default(true), // false for services
  taxable: boolean("taxable").default(true),
  serviceDetails: json("service_details"), // duration, appointment required, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const productSizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  sizeName: varchar("size_name", { length: 50 }).notNull(), // sm, med, large
  sizeLabel: varchar("size_label", { length: 100 }).notNull(), // Small, Medium, Large
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  priceModifier: decimal("price_modifier", { precision: 10, scale: 2 }).default("0.00"), // +/- from base price
  isDefault: boolean("is_default").default(false),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  customerName: text("customer_name").default("Walk-in Customer"),
  customerPhone: varchar("customer_phone", { length: 20 }),
  customerEmail: varchar("customer_email", { length: 100 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, cancelled, refunded
  orderType: varchar("order_type", { length: 20 }).default("dine-in"), // dine-in, takeout, delivery
  tableNumber: varchar("table_number", { length: 10 }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  managedBy: integer("managed_by").references(() => users.id), // for overrides
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  modifications: json("modifications"), // JSON array of modifications
  specialInstructions: text("special_instructions"),
  isComped: boolean("is_comped").default(false),
  compedBy: integer("comped_by").references(() => users.id),
  compReason: text("comp_reason"),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(), // cash, card, split
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentId: text("stripe_payment_id"),
  cashReceived: decimal("cash_received", { precision: 10, scale: 2 }),
  changeGiven: decimal("change_given", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).default("completed"), // pending, completed, failed, refunded
  processedBy: integer("processed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discounts = pgTable("discounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // percentage, fixed_amount
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  requiresManager: boolean("requires_manager").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taxRates = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull(), // e.g., 0.0825 for 8.25%
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: varchar("category", { length: 50 }).default("general"),
  description: text("description"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeClockSchema = createInsertSchema(timeClocks).omit({ id: true, createdAt: true });
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
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertDiscountSchema = createInsertSchema(discounts).omit({ id: true, createdAt: true });
export const insertTaxRateSchema = createInsertSchema(taxRates).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type TimeClock = typeof timeClocks.$inferSelect;
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
export type InsertTimeClock = z.infer<typeof insertTimeClockSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductSize = z.infer<typeof insertProductSizeSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Extended types for UI
export type UserWithTimeClock = User & { 
  currentTimeClock?: TimeClock; 
  todayHours?: number;
};

export type ProductWithCategory = Product & { 
  category?: Category;
  modifications?: any[];
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

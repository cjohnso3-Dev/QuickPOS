import { 
  users,
  timeClocks,
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
  type TimeClock,
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
  type InsertTimeClock,
  type InsertCategory, 
  type InsertProduct, 
  type InsertOrder, 
  type InsertOrderItem, 
  type InsertPayment,
  type InsertDiscount,
  type InsertTaxRate,
  type InsertAuditLog,
  type InsertSetting,
  type UserWithTimeClock,
  type ProductWithCategory,
  type OrderWithDetails,
  type CartItem,
  type PaymentSplit
} from "@shared/schema";

export interface IStorage {
  // Users
  getUsers(): Promise<UserWithTimeClock[]>;
  getUser(id: number): Promise<UserWithTimeClock | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Time Clocks
  clockIn(userId: number): Promise<TimeClock>;
  clockOut(userId: number): Promise<TimeClock | undefined>;
  getCurrentTimeClock(userId: number): Promise<TimeClock | undefined>;
  getTodayHours(userId: number): Promise<number>;
  getTimeClocks(userId: number, startDate?: Date, endDate?: Date): Promise<TimeClock[]>;
  
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
  getOrders(): Promise<OrderWithDetails[]>;
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private timeClocks: Map<number, TimeClock>;
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

  constructor() {
    this.users = new Map();
    this.timeClocks = new Map();
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
    
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default admin user
    const adminUser: User = {
      id: 1,
      username: "admin",
      email: "admin@vendorpos.com",
      passwordHash: "$2b$10$hashedpassword",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      isActive: true,
      hourlyRate: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(1, adminUser);

    // Create default manager
    const managerUser: User = {
      id: 2,
      username: "manager",
      email: "manager@vendorpos.com",
      passwordHash: "$2b$10$hashedpassword",
      firstName: "Manager",
      lastName: "User",
      role: "manager",
      isActive: true,
      hourlyRate: "25.00",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(2, managerUser);

    // Create default employee
    const employeeUser: User = {
      id: 3,
      username: "employee",
      email: "employee@vendorpos.com",
      passwordHash: "$2b$10$hashedpassword",
      firstName: "Employee",
      lastName: "User",
      role: "employee",
      isActive: true,
      hourlyRate: "15.00",
      createdAt: new Date(),
      updatedAt: new Date()
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
      { key: "manager_override_required", value: "true", category: "security", description: "Require manager for refunds/comps" }
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
    const usersWithTimeClock: UserWithTimeClock[] = [];
    
    for (const user of usersArray) {
      const currentTimeClock = await this.getCurrentTimeClock(user.id);
      const todayHours = await this.getTodayHours(user.id);
      usersWithTimeClock.push({
        ...user,
        currentTimeClock,
        todayHours
      });
    }
    
    return usersWithTimeClock;
  }

  async getUser(id: number): Promise<UserWithTimeClock | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const currentTimeClock = await this.getCurrentTimeClock(id);
    const todayHours = await this.getTodayHours(id);
    
    return {
      ...user,
      currentTimeClock,
      todayHours
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentId++;
    const newUser: User = {
      id,
      username: user.username,
      email: user.email || null,
      passwordHash: user.passwordHash,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      role: user.role || "employee",
      isActive: user.isActive !== false,
      hourlyRate: user.hourlyRate || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...user, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Time Clock methods
  async clockIn(userId: number): Promise<TimeClock> {
    const id = this.currentId++;
    const now = new Date();
    const timeClock: TimeClock = {
      id,
      userId,
      clockIn: now,
      clockOut: null,
      breakDuration: 0,
      totalHours: null,
      date: now,
      createdAt: now
    };
    this.timeClocks.set(id, timeClock);
    return timeClock;
  }

  async clockOut(userId: number): Promise<TimeClock | undefined> {
    const currentClock = await this.getCurrentTimeClock(userId);
    if (!currentClock) return undefined;

    const now = new Date();
    const totalHours = (now.getTime() - currentClock.clockIn.getTime()) / (1000 * 60 * 60);
    
    currentClock.clockOut = now;
    currentClock.totalHours = totalHours.toFixed(2);
    
    this.timeClocks.set(currentClock.id, currentClock);
    return currentClock;
  }

  async getCurrentTimeClock(userId: number): Promise<TimeClock | undefined> {
    return Array.from(this.timeClocks.values())
      .find(tc => tc.userId === userId && !tc.clockOut);
  }

  async getTodayHours(userId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayClocks = Array.from(this.timeClocks.values())
      .filter(tc => 
        tc.userId === userId && 
        tc.date >= today && 
        tc.date < tomorrow &&
        tc.totalHours
      );

    return todayClocks.reduce((total, tc) => total + parseFloat(tc.totalHours || "0"), 0);
  }

  async getTimeClocks(userId: number, startDate?: Date, endDate?: Date): Promise<TimeClock[]> {
    let clocks = Array.from(this.timeClocks.values())
      .filter(tc => tc.userId === userId);

    if (startDate) {
      clocks = clocks.filter(tc => tc.date >= startDate);
    }

    if (endDate) {
      clocks = clocks.filter(tc => tc.date <= endDate);
    }

    return clocks.sort((a, b) => b.date.getTime() - a.date.getTime());
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
    return productsArray.map(product => ({
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
      modifications: (product.modificationOptions as any[]) || []
    }));
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    return {
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined,
      modifications: (product.modificationOptions as any[]) || []
    };
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
      allowModifications: product.allowModifications !== false,
      modificationOptions: product.modificationOptions || null,
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
  async getOrders(): Promise<OrderWithDetails[]> {
    const ordersArray = Array.from(this.orders.values());
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

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    const orderNumber = `ORD-${Date.now()}`;
    const newOrder: Order = { 
      id,
      orderNumber,
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
    let timeClocks = Array.from(this.timeClocks.values());
    
    if (userId) {
      timeClocks = timeClocks.filter(tc => tc.userId === userId);
    }
    
    if (startDate) {
      timeClocks = timeClocks.filter(tc => tc.date >= startDate);
    }
    
    if (endDate) {
      timeClocks = timeClocks.filter(tc => tc.date <= endDate);
    }

    const totalHours = timeClocks.reduce((sum, tc) => sum + parseFloat(tc.totalHours || "0"), 0);
    
    return {
      userId,
      period: { startDate, endDate },
      totalHours,
      timeClocks: timeClocks.sort((a, b) => b.date.getTime() - a.date.getTime())
    };
  }
}

export const storage = new MemStorage();
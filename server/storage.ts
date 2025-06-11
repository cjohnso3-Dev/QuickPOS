import { 
  categories, 
  products, 
  orders, 
  orderItems, 
  settings,
  type Category, 
  type Product, 
  type Order, 
  type OrderItem, 
  type Setting,
  type InsertCategory, 
  type InsertProduct, 
  type InsertOrder, 
  type InsertOrderItem, 
  type InsertSetting,
  type ProductWithCategory,
  type OrderWithItems
} from "@shared/schema";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Products
  getProducts(): Promise<ProductWithCategory[]>;
  getProduct(id: number): Promise<ProductWithCategory | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  updateProductStock(id: number, stock: number): Promise<Product | undefined>;
  
  // Orders
  getOrders(): Promise<OrderWithItems[]>;
  getOrder(id: number): Promise<OrderWithItems | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  
  // Order Items
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<(OrderItem & { product: Product })[]>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;
  getSettings(): Promise<Setting[]>;
  
  // Stats
  getTodayStats(): Promise<{
    todaySales: number;
    todayOrders: number;
    lowStockCount: number;
    activeProductCount: number;
  }>;
}

export class MemStorage implements IStorage {
  private categories: Map<number, Category>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private settingsMap: Map<string, Setting>;
  private currentId: number;

  constructor() {
    this.categories = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.settingsMap = new Map();
    this.currentId = 1;
    
    // Initialize with default categories
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default categories
    const defaultCategories = [
      { id: 1, name: "Beverages", description: "Hot and cold beverages" },
      { id: 2, name: "Food", description: "Main food items" },
      { id: 3, name: "Desserts", description: "Sweet treats and desserts" }
    ];
    
    defaultCategories.forEach(cat => {
      this.categories.set(cat.id, cat);
    });

    // Create default products
    const defaultProducts = [
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
        createdAt: new Date()
      },
      {
        id: 3,
        name: "Butter Croissant",
        description: "Flaky, buttery pastry",
        price: "3.49",
        categoryId: 3,
        imageUrl: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "CRO001",
        stock: 8,
        minStock: 5,
        maxStock: 25,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 4,
        name: "Fresh Orange Juice",
        description: "100% fresh squeezed",
        price: "5.99",
        categoryId: 1,
        imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "JUI001",
        stock: 15,
        minStock: 10,
        maxStock: 40,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 5,
        name: "Garden Salad",
        description: "Mixed greens with vinaigrette",
        price: "7.99",
        categoryId: 2,
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "SAL001",
        stock: 6,
        minStock: 5,
        maxStock: 20,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: 6,
        name: "Blueberry Muffin",
        description: "Fresh blueberries, fluffy texture",
        price: "2.99",
        categoryId: 3,
        imageUrl: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        sku: "MUF001",
        stock: 10,
        minStock: 8,
        maxStock: 30,
        isActive: true,
        createdAt: new Date()
      }
    ];

    defaultProducts.forEach(product => {
      this.products.set(product.id, product);
    });

    // Initialize default settings
    const defaultSettings = [
      { key: "store_name", value: "Main Location" },
      { key: "tax_rate", value: "8.25" },
      { key: "currency", value: "USD" },
      { key: "timezone", value: "America/New_York" }
    ];

    defaultSettings.forEach(setting => {
      this.settingsMap.set(setting.key, { id: this.currentId++, ...setting });
    });

    this.currentId = 100; // Start IDs from 100 to avoid conflicts
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.currentId++;
    const newCategory: Category = { ...category, id };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async getProducts(): Promise<ProductWithCategory[]> {
    const productsArray = Array.from(this.products.values());
    return productsArray.map(product => ({
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined
    }));
  }

  async getProduct(id: number): Promise<ProductWithCategory | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    return {
      ...product,
      category: product.categoryId ? this.categories.get(product.categoryId) : undefined
    };
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentId++;
    const newProduct: Product = { 
      ...product, 
      id, 
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

  async getOrders(): Promise<OrderWithItems[]> {
    const ordersArray = Array.from(this.orders.values());
    const ordersWithItems: OrderWithItems[] = [];

    for (const order of ordersArray) {
      const items = await this.getOrderItems(order.id);
      ordersWithItems.push({ ...order, items });
    }

    return ordersWithItems.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getOrder(id: number): Promise<OrderWithItems | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const items = await this.getOrderItems(id);
    return { ...order, items };
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    const newOrder: Order = { 
      ...order, 
      id, 
      createdAt: new Date()
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    order.status = status;
    this.orders.set(id, order);
    return order;
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentId++;
    const newOrderItem: OrderItem = { ...orderItem, id };
    this.orderItems.set(id, newOrderItem);
    return newOrderItem;
  }

  async getOrderItems(orderId: number): Promise<(OrderItem & { product: Product })[]> {
    const items = Array.from(this.orderItems.values())
      .filter(item => item.orderId === orderId);
    
    return items.map(item => ({
      ...item,
      product: this.products.get(item.productId)!
    }));
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settingsMap.get(key);
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = this.settingsMap.get(key);
    if (existing) {
      existing.value = value;
      this.settingsMap.set(key, existing);
      return existing;
    } else {
      const id = this.currentId++;
      const newSetting: Setting = { id, key, value };
      this.settingsMap.set(key, newSetting);
      return newSetting;
    }
  }

  async getSettings(): Promise<Setting[]> {
    return Array.from(this.settingsMap.values());
  }

  async getTodayStats(): Promise<{
    todaySales: number;
    todayOrders: number;
    lowStockCount: number;
    activeProductCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = Array.from(this.orders.values())
      .filter(order => {
        const orderDate = new Date(order.createdAt!);
        return orderDate >= today;
      });

    const todaySales = todayOrders.reduce((sum, order) => 
      sum + parseFloat(order.total), 0
    );

    const lowStockCount = Array.from(this.products.values())
      .filter(product => product.stock <= product.minStock!).length;

    const activeProductCount = Array.from(this.products.values())
      .filter(product => product.isActive).length;

    return {
      todaySales,
      todayOrders: todayOrders.length,
      lowStockCount,
      activeProductCount
    };
  }
}

export const storage = new MemStorage();

import { eq, sql } from 'drizzle-orm'; // Added sql import
import { db } from '../server/db';
import {
  users,
  appRoles,
  userAppRoles,
  categories,
  products,
  taxRates,
  discounts,
  settings,
  type InsertUser,
  type InsertAppRole,
  type InsertCategory,
  type InsertProduct,
  type InsertTaxRate,
  type InsertDiscount,
  type InsertSetting
} from '../shared/schema';
import bcrypt from 'bcrypt';

const rolesData = {
  "front_of_house": {
    "restaurant": [
      {
        "role": "Host / Hostess",
        "description": "Greets guests, manages reservations and waitlists, seats customers, and sets the initial tone for the dining experience."
      },
      {
        "role": "Server / Waiter / Waitress",
        "description": "Takes orders, answers questions about the menu, serves food and drinks, and processes payments."
      },
      {
        "role": "Bartender",
        "description": "Prepares alcoholic and non-alcoholic beverages, manages the bar area, and serves customers at the bar."
      },
      {
        "role": "Busser / Server Assistant",
        "description": "Supports servers by clearing, cleaning, and resetting tables, and refilling water glasses."
      },
      {
        "role": "Food Runner",
        "description": "Delivers finished dishes from the kitchen to the correct tables, ensuring speed and accuracy."
      },
      {
        "role": "Sommelier",
        "description": "A wine specialist who recommends and serves wine, manages the wine cellar, and trains staff."
      }
    ],
    "retail": [
      {
        "role": "Sales Associate / Clerk",
        "description": "Assists customers with finding products, provides product knowledge, and helps drive sales."
      },
      {
        "role": "Cashier",
        "description": "Manages the point of sale (POS) system, handles payment transactions, and processes returns."
      },
      {
        "role": "Greeter",
        "description": "Welcomes customers at the entrance, offers shopping carts/baskets, and provides basic directional help."
      },
      {
        "role": "Customer Service Representative",
        "description": "Handles complex issues like returns, exchanges, complaints, and product inquiries at a dedicated desk."
      },
      {
        "role": "Personal Shopper / Stylist",
        "description": "Provides one-on-one assistance to help customers find items that meet their specific needs or style."
      },
      {
        "role": "Department Specialist",
        "description": "An associate with deep knowledge in a specific area, like electronics, produce, or hardware."
      }
    ]
  },
  "back_of_house": {
    "restaurant": [
      {
        "role": "Executive Chef / Head Chef",
        "description": "Leads the kitchen, responsible for menu creation, food costing, staff management, and overall kitchen operations."
      },
      {
        "role": "Sous Chef",
        "description": "The second-in-command in the kitchen who manages staff day-to-day and oversees food production."
      },
      {
        "role": "Line Cook",
        "description": "Assigned to a specific station (e.g., grill, sauté, fryer) and responsible for cooking dishes on order."
      },
      {
        "role": "Prep Cook",
        "description": "Prepares ingredients before service begins, such as chopping vegetables, making sauces, and portioning meats."
      },
      {
        "role": "Dishwasher",
        "description": "Cleans all dishes, cookware, and utensils, ensuring the kitchen and FOH have what they need to operate."
      },
      {
        "role": "Expeditor (Expo)",
        "description": "Organizes finished plates for each order, checks for accuracy, and coordinates between the kitchen and servers."
      }
    ],
    "retail": [
      {
        "role": "Stock Associate / Stocker",
        "description": "Receives shipments, organizes the stockroom, and replenishes merchandise on the sales floor."
      },
      {
        "role": "Inventory Manager",
        "description": "Tracks all stock, conducts inventory counts, analyzes sales data, and places orders for new products."
      },
      {
        "role": "Receiving Clerk",
        "description": "Checks incoming shipments against purchase orders to ensure accuracy and inspects for damage."
      },
      {
        "role": "Visual Merchandiser",
        "description": "Plans and executes the store's visual presentation, including window displays and in-store promotions."
      },
      {
        "role": "Loss Prevention / Security",
        "description": "Monitors the store via cameras and physical presence to prevent theft and ensure safety."
      }
    ]
  },
  "management_hybrid": [
    {
      "role": "General Manager (GM) / Store Manager",
      "description": "Oversees the entire operation, including profitability, hiring, training, and ensuring both FOH and BOH meet standards."
    },
    {
      "role": "Assistant Manager",
      "description": "Supports the General Manager and often has a specific focus on FOH, BOH, or a specific department."
    }
  ]
};

const SALT_ROUNDS = 10;

async function seed() {
  console.log('Seeding database...');

  // Seed AppRoles
  const allRoles: InsertAppRole[] = [];
  for (const categoryKey in rolesData) {
    const category = rolesData[categoryKey as keyof typeof rolesData];
    if (Array.isArray(category)) { // For management_hybrid
      category.forEach(role => {
        allRoles.push({
          name: role.role,
          description: role.description,
          category: categoryKey,
        });
      });
    } else { // For front_of_house and back_of_house
      for (const subCategoryKey in category) {
        const subCategory = category[subCategoryKey as keyof typeof category];
        subCategory.forEach(role => {
          allRoles.push({
            name: role.role,
            description: role.description,
            category: `${categoryKey}_${subCategoryKey}`,
          });
        });
      }
    }
  }

  console.log(`Inserting ${allRoles.length} roles...`);
  await db.insert(appRoles).values(allRoles).onConflictDoNothing();
  console.log('Roles seeded.');

  // Seed Default Manager User
  const managerEmployeeCode = '12345';
  const managerPin = '1234';

  const existingManager = await db.select().from(users).where(eq(users.employeeCode, managerEmployeeCode)).limit(1);

  if (existingManager.length === 0) {
    const hashedPin = await bcrypt.hash(managerPin, SALT_ROUNDS);
    const newManager: InsertUser = {
      employeeCode: managerEmployeeCode,
      pinHash: hashedPin,
      firstName: 'Default',
      lastName: 'Manager',
      isActive: true,
      email: 'manager@example.com' // Optional: add a default email
    };
    const insertedUser = await db.insert(users).values(newManager).returning({ id: users.id });
    const managerUserId = insertedUser[0].id;

    // Find the GM role
    const gmRole = await db.select().from(appRoles).where(eq(appRoles.name, 'General Manager (GM) / Store Manager')).limit(1);
    if (gmRole.length > 0 && managerUserId) {
      await db.insert(userAppRoles).values({
        userId: managerUserId,
        roleId: gmRole[0].id,
      }).onConflictDoNothing();
      console.log('Default manager user created and assigned GM role.');
    } else {
      console.error('Could not find General Manager role or create manager user.');
    }
  } else {
    console.log('Default manager user already exists.');
  }

  // Seed Categories
  const defaultCategories: InsertCategory[] = [
    { name: "Beverages", description: "Hot and cold beverages", sortOrder: 1, isActive: true },
    { name: "Food", description: "Main food items", sortOrder: 2, isActive: true },
    { name: "Sides", description: "Snacks and sides", sortOrder: 3, isActive: true },
    { name: "Desserts", description: "Sweet treats", sortOrder: 4, isActive: true },
  ];
  console.log(`Inserting ${defaultCategories.length} categories...`);
  await db.insert(categories).values(defaultCategories).onConflictDoNothing();
  console.log('Categories seeded.');

  // Fetch seeded categories to get their IDs for product assignment
  const seededCategories = await db.select().from(categories);
  const beveragesCat = seededCategories.find(c => c.name === "Beverages");
  const foodCat = seededCategories.find(c => c.name === "Food");
  const sidesCat = seededCategories.find(c => c.name === "Sides");
  const dessertsCat = seededCategories.find(c => c.name === "Desserts");

  // Seed Products
  const defaultProducts: InsertProduct[] = [];
  if (beveragesCat) {
    defaultProducts.push(
      {
        name: "Espresso",
        description: "Strong black coffee",
        price: "3.00",
        categoryId: beveragesCat.id,
        sku: "BEV001",
        stock: 100,
        isActive: true,
        modificationOptions: JSON.stringify([
          { id: "milk-none", name: "No Milk", category: "milk", price: 0 },
          { id: "milk-whole", name: "Whole Milk", category: "milk", price: 0.50 },
          { id: "milk-oat", name: "Oat Milk", category: "milk", price: 0.75 }
        ])
      },
      {
        name: "Latte",
        description: "Espresso with steamed milk",
        price: "4.50",
        categoryId: beveragesCat.id,
        sku: "BEV002",
        stock: 100,
        isActive: true,
        modificationOptions: JSON.stringify([
          { id: "size-small", name: "Small", category: "size", price: 0 },
          { id: "size-medium", name: "Medium", category: "size", price: 0.50 },
          { id: "size-large", name: "Large", category: "size", price: 1.00 }
        ])
      }
    );
  }
  if (foodCat) {
    defaultProducts.push(
      {
        name: "Avocado Toast",
        description: "Sourdough with avocado and seasoning",
        price: "8.50",
        categoryId: foodCat.id,
        sku: "FOOD001",
        stock: 50,
        isActive: true
      },
      {
        name: "Chicken Sandwich",
        description: "Grilled chicken with lettuce and tomato",
        price: "10.00",
        categoryId: foodCat.id,
        sku: "FOOD002",
        stock: 30,
        isActive: true
      }
    );
  }
   if (sidesCat) {
    defaultProducts.push(
      { name: "Fries", description: "Crispy golden fries", price: "3.50", categoryId: sidesCat.id, sku: "SIDE001", stock: 200, isActive: true }
    );
  }
  if (dessertsCat) {
    defaultProducts.push(
      { name: "Chocolate Cake", description: "Rich decadent chocolate cake", price: "6.00", categoryId: dessertsCat.id, sku: "DES001", stock: 20, isActive: true }
    );
  }

  if (defaultProducts.length > 0) {
    console.log(`Inserting ${defaultProducts.length} products...`);
    await db.insert(products).values(defaultProducts).onConflictDoNothing(); // Assuming SKU is unique for onConflictDoNothing
    console.log('Products seeded.');
  } else {
    console.log('No products to seed (possibly due to categories not found).');
  }
  
  // Seed Tax Rates
  const defaultTaxRates: InsertTaxRate[] = [
    { name: "Standard Sales Tax", rate: "0.0825", isDefault: true, isActive: true },
    { name: "Food Tax (Lower)", rate: "0.0600", isDefault: false, isActive: true },
  ];
  console.log(`Inserting ${defaultTaxRates.length} tax rates...`);
  await db.insert(taxRates).values(defaultTaxRates).onConflictDoNothing();
  console.log('Tax rates seeded.');

  // Seed Discounts
  const defaultDiscounts: InsertDiscount[] = [
    { name: "Employee Discount", type: "percentage", value: "15", isActive: true, requiresManager: false },
    { name: "Loyalty 10%", type: "percentage", value: "10", isActive: true, requiresManager: false },
    { name: "Manager Comp", type: "fixed_amount", value: "5.00", isActive: true, requiresManager: true },
  ];
  console.log(`Inserting ${defaultDiscounts.length} discounts...`);
  await db.insert(discounts).values(defaultDiscounts).onConflictDoNothing();
  console.log('Discounts seeded.');

  // Seed Settings
  const defaultSettings: InsertSetting[] = [
    { key: "store_name", value: "VendorPOS Flagship", category: "general", description: "The public name of the store." },
    { key: "currency_symbol", value: "$", category: "localization", description: "Currency symbol to display." },
    { key: "default_tax_rate_id", value: "1", category: "taxes", description: "ID of the default tax rate to apply." }, // Assuming ID 1 is standard sales tax
    { key: "allow_tips", value: "true", category: "payments", description: "Enable or disable tipping functionality." },
    { key: "tip_suggestions_percent", value: "15,18,20,25", category: "payments", description: "Comma-separated tip percentage suggestions." },
  ];
  console.log(`Inserting ${defaultSettings.length} settings...`);
  await db.insert(settings).values(defaultSettings).onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value`, category: sql`excluded.category`, description: sql`excluded.description` } });
  console.log('Settings seeded.');


  console.log('Database seeding complete.');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../stockroom.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initSchema(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('store_keeper','chef','fb_manager','purchase_manager')),
      property_id TEXT REFERENCES properties(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      base_unit TEXT NOT NULL,
      par_level_base_units REAL NOT NULL DEFAULT 0,
      reorder_quantity_base_units REAL NOT NULL DEFAULT 0,
      vendor_name TEXT,
      vendor_lead_time_days INTEGER,
      vendor_price_per_base_unit REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unit_conversions (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      from_unit TEXT NOT NULL,
      factor REAL NOT NULL,
      UNIQUE(ingredient_id, from_unit)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('receive','issue','consume','waste','adjust')),
      quantity_base_units REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      recorded_by TEXT NOT NULL REFERENCES users(id),
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      requested_quantity_base_units REAL NOT NULL,
      approved_quantity_base_units REAL,
      display_unit TEXT NOT NULL DEFAULT 'kg',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','adjusted','rejected','ordered')),
      raised_by TEXT NOT NULL REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','partial','complete')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      request_id TEXT REFERENCES purchase_requests(id),
      quantity_ordered_base_units REAL NOT NULL,
      quantity_received_base_units REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','complete','short','damaged'))
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      quantity_base_units REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      name TEXT NOT NULL,
      recipe_id TEXT REFERENCES recipes(id),
      category TEXT NOT NULL,
      selling_price REAL
    );

    CREATE TABLE IF NOT EXISTS service_logs (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
      quantity_prepared INTEGER NOT NULL,
      logged_by TEXT NOT NULL REFERENCES users(id),
      logged_at TEXT DEFAULT (datetime('now')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','pos_event'))
    );

    CREATE TABLE IF NOT EXISTS wastage_logs (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      quantity_base_units REAL NOT NULL,
      reason TEXT,
      logged_by TEXT NOT NULL REFERENCES users(id),
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      alert_type TEXT NOT NULL CHECK(alert_type IN ('low_stock','breach_par','critical')),
      message TEXT NOT NULL,
      days_until_stockout REAL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acknowledged','resolved')),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function seedData(): void {
  const database = getDb();
  const count = (database.prepare('SELECT COUNT(*) as c FROM properties').get() as { c: number }).c;
  if (count > 0) return;

  const insert = database.transaction(() => {
    // Properties
    const p1 = uuidv4(), p2 = uuidv4();
    database.prepare('INSERT INTO properties (id,name) VALUES (?,?)').run(p1, 'Grand Hotel Mumbai');
    database.prepare('INSERT INTO properties (id,name) VALUES (?,?)').run(p2, 'Bay View Hotel Goa');

    // Users
    const u1 = uuidv4(), u2 = uuidv4(), u3 = uuidv4(), u4 = uuidv4();
    const u5 = uuidv4(), u6 = uuidv4(), u7 = uuidv4();
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u1,'Kavitha','store_keeper',p1);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u2,'Ramesh','chef',p1);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u3,'Arjun','fb_manager',p1);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u4,'Meena','purchase_manager',null);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u5,'Priya','store_keeper',p2);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u6,'Chef Raj','chef',p2);
    database.prepare('INSERT INTO users (id,name,role,property_id) VALUES (?,?,?,?)').run(u7,'Sunita','fb_manager',p2);

    // Store user IDs in a way we can retrieve them
    database.prepare('UPDATE properties SET name=? WHERE id=?').run(`Grand Hotel Mumbai|${u1}|${u2}|${u3}`, p1);
    database.prepare('UPDATE properties SET name=? WHERE id=?').run('Grand Hotel Mumbai', p1);
    database.prepare('UPDATE properties SET name=? WHERE id=?').run('Bay View Hotel Goa', p2);

    // Helper to insert ingredient + conversions
    const insertIngredient = (
      propertyId: string, name: string, category: string, baseUnit: string,
      parLevel: number, reorderQty: number, price: number,
      vendor: string, leadDays: number,
      conversions: { unit: string, factor: number }[]
    ) => {
      const id = uuidv4();
      database.prepare(`
        INSERT INTO ingredients (id,property_id,name,category,base_unit,par_level_base_units,reorder_quantity_base_units,vendor_name,vendor_lead_time_days,vendor_price_per_base_unit)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(id, propertyId, name, category, baseUnit, parLevel, reorderQty, vendor, leadDays, price);
      for (const c of conversions) {
        database.prepare('INSERT INTO unit_conversions (id,ingredient_id,from_unit,factor) VALUES (?,?,?,?)').run(uuidv4(), id, c.unit, c.factor);
      }
      return id;
    };

    // P1 Ingredients (base unit grams/ml/piece)
    const chicken_p1 = insertIngredient(p1,'Chicken Breast','Meat','g',5000,8000,0.00035,'FreshMeats',1,[{unit:'kg',factor:1000},{unit:'piece',factor:200},{unit:'case',factor:10000}]);
    const rice_p1 = insertIngredient(p1,'Basmati Rice','Grains','g',10000,15000,0.00008,'GrainMasters',2,[{unit:'kg',factor:1000},{unit:'case',factor:25000}]);
    const onion_p1 = insertIngredient(p1,'Onion','Vegetables','g',8000,12000,0.00002,'VegSupply',1,[{unit:'kg',factor:1000},{unit:'case',factor:20000}]);
    const tomato_p1 = insertIngredient(p1,'Tomato','Vegetables','g',5000,8000,0.00003,'VegSupply',1,[{unit:'kg',factor:1000},{unit:'case',factor:10000}]);
    const oil_p1 = insertIngredient(p1,'Cooking Oil','Oils','ml',10000,15000,0.000012,'OilMart',3,[{unit:'litre',factor:1000},{unit:'case',factor:15000}]);
    const butter_p1 = insertIngredient(p1,'Butter','Dairy','g',2000,3000,0.00045,'DairyFarm',2,[{unit:'kg',factor:1000},{unit:'block',factor:500}]);
    const cream_p1 = insertIngredient(p1,'Fresh Cream','Dairy','ml',2000,4000,0.00022,'DairyFarm',2,[{unit:'litre',factor:1000},{unit:'pack',factor:200}]);
    const eggs_p1 = insertIngredient(p1,'Eggs','Dairy','piece',50,100,8,'LocalFarm',1,[{unit:'dozen',factor:12},{unit:'tray',factor:30},{unit:'case',factor:180}]);
    const paneer_p1 = insertIngredient(p1,'Paneer','Dairy','g',3000,5000,0.00045,'DairyFarm',2,[{unit:'kg',factor:1000},{unit:'block',factor:500}]);
    const garam_p1 = insertIngredient(p1,'Garam Masala','Spices','g',500,1000,0.00055,'SpiceMart',5,[{unit:'kg',factor:1000},{unit:'pack',factor:100}]);
    const salt_p1 = insertIngredient(p1,'Salt','Spices','g',2000,4000,0.000005,'SpiceMart',5,[{unit:'kg',factor:1000}]);
    const lentils_p1 = insertIngredient(p1,'Black Lentils','Grains','g',5000,8000,0.00012,'GrainMasters',2,[{unit:'kg',factor:1000},{unit:'case',factor:25000}]);
    const milk_p1 = insertIngredient(p1,'Milk','Dairy','ml',5000,8000,0.000008,'DairyFarm',1,[{unit:'litre',factor:1000},{unit:'case',factor:12000}]);
    const flour_p1 = insertIngredient(p1,'All-Purpose Flour','Grains','g',8000,12000,0.00006,'GrainMasters',2,[{unit:'kg',factor:1000},{unit:'case',factor:25000}]);

    // P2 Ingredients
    const fish_p2 = insertIngredient(p2,'Fresh Fish','Seafood','g',4000,6000,0.00055,'CoastalSeafood',1,[{unit:'kg',factor:1000},{unit:'piece',factor:300}]);
    const prawns_p2 = insertIngredient(p2,'Prawns','Seafood','g',3000,5000,0.00095,'CoastalSeafood',1,[{unit:'kg',factor:1000},{unit:'case',factor:5000}]);
    const coconut_p2 = insertIngredient(p2,'Coconut Milk','Liquids','ml',5000,8000,0.000018,'LocalFarm',1,[{unit:'litre',factor:1000},{unit:'can',factor:400}]);
    const rice_p2 = insertIngredient(p2,'Basmati Rice','Grains','g',10000,15000,0.00009,'GrainMasters',2,[{unit:'kg',factor:1000}]);
    const oil_p2 = insertIngredient(p2,'Cooking Oil','Oils','ml',8000,12000,0.000012,'OilMart',3,[{unit:'litre',factor:1000}]);

    // Add initial stock (receive transactions) for P1
    const addStock = (propertyId: string, ingredientId: string, qty: number, userId: string, notes: string) => {
      database.prepare(`
        INSERT INTO stock_transactions (id,property_id,ingredient_id,transaction_type,quantity_base_units,reference_type,notes,recorded_by,recorded_at)
        VALUES (?,?,?,'receive',?,?,?,?,datetime('now','-7 days'))
      `).run(uuidv4(), propertyId, ingredientId, qty, 'manual', notes, userId);
    };

    // P1 initial stock
    addStock(p1, chicken_p1, 12000, u1, 'Opening stock');
    addStock(p1, rice_p1, 25000, u1, 'Opening stock');
    addStock(p1, onion_p1, 15000, u1, 'Opening stock');
    addStock(p1, tomato_p1, 10000, u1, 'Opening stock');
    addStock(p1, oil_p1, 20000, u1, 'Opening stock');
    addStock(p1, butter_p1, 4000, u1, 'Opening stock');
    addStock(p1, cream_p1, 5000, u1, 'Opening stock');
    addStock(p1, eggs_p1, 120, u1, 'Opening stock');
    addStock(p1, paneer_p1, 8000, u1, 'Opening stock');
    addStock(p1, garam_p1, 1500, u1, 'Opening stock');
    addStock(p1, salt_p1, 5000, u1, 'Opening stock');
    addStock(p1, lentils_p1, 10000, u1, 'Opening stock');
    addStock(p1, milk_p1, 10000, u1, 'Opening stock');
    addStock(p1, flour_p1, 15000, u1, 'Opening stock');

    // P2 initial stock
    addStock(p2, fish_p2, 8000, u5, 'Opening stock');
    addStock(p2, prawns_p2, 5000, u5, 'Opening stock');
    addStock(p2, coconut_p2, 8000, u5, 'Opening stock');
    addStock(p2, rice_p2, 15000, u5, 'Opening stock');
    addStock(p2, oil_p2, 12000, u5, 'Opening stock');

    // Simulate weekly consumption for P1 (so some items are low)
    const consume = (propertyId: string, ingredientId: string, qty: number, userId: string) => {
      database.prepare(`
        INSERT INTO stock_transactions (id,property_id,ingredient_id,transaction_type,quantity_base_units,reference_type,notes,recorded_by,recorded_at)
        VALUES (?,?,?,'consume',?,?,?,?,datetime('now','-3 days'))
      `).run(uuidv4(), propertyId, ingredientId, -qty, 'service_log', 'End of service consumption', userId);
    };

    consume(p1, chicken_p1, 8500, u2);   // leaves 3500 < par 5000 → LOW
    consume(p1, rice_p1, 16000, u2);      // leaves 9000 < par 10000 → LOW
    consume(p1, onion_p1, 7000, u2);      // leaves 8000 = par ok
    consume(p1, tomato_p1, 9200, u2);     // leaves 800 << par 5000 → CRITICAL
    consume(p1, butter_p1, 3500, u2);     // leaves 500 << par 2000 → CRITICAL
    consume(p1, cream_p1, 3200, u2);      // leaves 1800 < par 2000 → LOW
    consume(p1, eggs_p1, 95, u2);         // leaves 25 < par 50 → LOW
    consume(p1, paneer_p1, 5500, u2);     // leaves 2500 < par 3000 → LOW
    consume(p1, garam_p1, 800, u2);       // leaves 700 > par 500 → ok
    consume(p1, lentils_p1, 4000, u2);    // leaves 6000 > par 5000 → ok
    consume(p1, milk_p1, 7000, u2);       // leaves 3000 < par 5000 → LOW
    consume(p1, flour_p1, 10000, u2);     // leaves 5000 < par 8000 → LOW

    // Wastage
    database.prepare(`
      INSERT INTO stock_transactions (id,property_id,ingredient_id,transaction_type,quantity_base_units,reference_type,notes,recorded_by,recorded_at)
      VALUES (?,?,?,'waste',?,?,?,?,datetime('now','-2 days'))
    `).run(uuidv4(), p1, tomato_p1, -500, 'wastage_log', 'Spoiled - overripe', u1);

    database.prepare(`
      INSERT INTO stock_transactions (id,property_id,ingredient_id,transaction_type,quantity_base_units,reference_type,notes,recorded_by,recorded_at)
      VALUES (?,?,?,'waste',?,?,?,?,datetime('now','-1 days'))
    `).run(uuidv4(), p1, milk_p1, -1000, 'wastage_log', 'Expired - past use-by date', u1);

    // P2 consumption
    consume(p2, fish_p2, 5000, u6);       // leaves 3000 < par 4000 → LOW
    consume(p2, prawns_p2, 2500, u6);     // leaves 2500 < par 3000 → LOW

    // Recipes for P1
    const r1 = uuidv4(), r2 = uuidv4(), r3 = uuidv4(), r4 = uuidv4();
    database.prepare('INSERT INTO recipes (id,property_id,name,category) VALUES (?,?,?,?)').run(r1, p1, 'Butter Chicken', 'Main Course');
    database.prepare('INSERT INTO recipes (id,property_id,name,category) VALUES (?,?,?,?)').run(r2, p1, 'Dal Makhani', 'Main Course');
    database.prepare('INSERT INTO recipes (id,property_id,name,category) VALUES (?,?,?,?)').run(r3, p1, 'Veg Biryani', 'Main Course');
    database.prepare('INSERT INTO recipes (id,property_id,name,category) VALUES (?,?,?,?)').run(r4, p1, 'Paneer Butter Masala', 'Main Course');

    const ri = (recipeId: string, ingredientId: string, qty: number) =>
      database.prepare('INSERT INTO recipe_ingredients (id,recipe_id,ingredient_id,quantity_base_units) VALUES (?,?,?,?)').run(uuidv4(), recipeId, ingredientId, qty);

    // Butter Chicken: 250g chicken, 100g tomato, 50ml cream, 20g garam masala, 30g butter, 50g onion
    ri(r1, chicken_p1, 250); ri(r1, tomato_p1, 100); ri(r1, cream_p1, 50);
    ri(r1, garam_p1, 20); ri(r1, butter_p1, 30); ri(r1, onion_p1, 50);

    // Dal Makhani: 100g lentils, 50g onion, 30g tomato, 20g butter, 30ml cream
    ri(r2, lentils_p1, 100); ri(r2, onion_p1, 50); ri(r2, tomato_p1, 30);
    ri(r2, butter_p1, 20); ri(r2, cream_p1, 30);

    // Veg Biryani: 200g rice, 100g onion, 50g tomato, 50ml oil, 10g garam masala
    ri(r3, rice_p1, 200); ri(r3, onion_p1, 100); ri(r3, tomato_p1, 50);
    ri(r3, oil_p1, 50); ri(r3, garam_p1, 10);

    // Paneer Butter Masala: 200g paneer, 80g tomato, 40g butter, 40ml cream, 15g garam masala
    ri(r4, paneer_p1, 200); ri(r4, tomato_p1, 80); ri(r4, butter_p1, 40);
    ri(r4, cream_p1, 40); ri(r4, garam_p1, 15);

    // Menu items
    const m1 = uuidv4(), m2 = uuidv4(), m3 = uuidv4(), m4 = uuidv4();
    database.prepare('INSERT INTO menu_items (id,property_id,name,recipe_id,category,selling_price) VALUES (?,?,?,?,?,?)').run(m1, p1, 'Butter Chicken', r1, 'Main Course', 450);
    database.prepare('INSERT INTO menu_items (id,property_id,name,recipe_id,category,selling_price) VALUES (?,?,?,?,?,?)').run(m2, p1, 'Dal Makhani', r2, 'Main Course', 280);
    database.prepare('INSERT INTO menu_items (id,property_id,name,recipe_id,category,selling_price) VALUES (?,?,?,?,?,?)').run(m3, p1, 'Veg Biryani', r3, 'Main Course', 320);
    database.prepare('INSERT INTO menu_items (id,property_id,name,recipe_id,category,selling_price) VALUES (?,?,?,?,?,?)').run(m4, p1, 'Paneer Butter Masala', r4, 'Main Course', 380);

    // Service logs for this week (for reconciliation demo)
    const logService = (propertyId: string, menuItemId: string, qty: number, userId: string, daysAgo: number) => {
      database.prepare(`
        INSERT INTO service_logs (id,property_id,menu_item_id,quantity_prepared,logged_by,logged_at,source)
        VALUES (?,?,?,?,?,datetime('now','-' || ? || ' days'),'manual')
      `).run(uuidv4(), propertyId, menuItemId, qty, userId, daysAgo);
    };
    logService(p1, m1, 12, u2, 6); logService(p1, m1, 15, u2, 5); logService(p1, m1, 18, u2, 4);
    logService(p1, m2, 20, u2, 6); logService(p1, m2, 22, u2, 5); logService(p1, m2, 25, u2, 4);
    logService(p1, m3, 10, u2, 6); logService(p1, m3, 12, u2, 5);
    logService(p1, m4, 8, u2, 6);  logService(p1, m4, 10, u2, 5);

    // A pending purchase request (raised by Ramesh)
    const pr1 = uuidv4();
    database.prepare(`
      INSERT INTO purchase_requests (id,property_id,ingredient_id,requested_quantity_base_units,display_unit,status,raised_by,notes,created_at,updated_at)
      VALUES (?,?,?,?,'kg','pending',?,?,datetime('now','-1 days'),datetime('now','-1 days'))
    `).run(pr1, p1, chicken_p1, 10000, u2, 'Running low - need before weekend service');

    const pr2 = uuidv4();
    database.prepare(`
      INSERT INTO purchase_requests (id,property_id,ingredient_id,requested_quantity_base_units,display_unit,status,raised_by,notes,created_at,updated_at)
      VALUES (?,?,?,?,'kg','approved',?,?,datetime('now','-2 days'),datetime('now','-1 days'))
    `).run(pr2, p1, tomato_p1, 15000, u1, 'Almost out - urgent');
    database.prepare('UPDATE purchase_requests SET approved_by=?,approved_quantity_base_units=12000 WHERE id=?').run(u3, pr2);

    console.log('[seed] Database seeded successfully.');
    console.log(`[seed] P1 ID: ${p1}, P2 ID: ${p2}`);
    console.log(`[seed] Users - Kavitha:${u1}, Ramesh:${u2}, Arjun:${u3}, Meena:${u4}`);
  });

  insert();
}

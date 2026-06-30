import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { recordTransaction } from '../services/stockLedger';
import { refreshAlerts } from '../services/alertService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/service-logs — log dish prepared (deducts recipe ingredients)
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, menuItemId, quantityPrepared, loggedBy, source = 'manual' } = req.body;

  if (!propertyId || !menuItemId || !quantityPrepared || !loggedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const logId = uuidv4();

    const deductions = db.transaction(() => {
      // Get recipe for this menu item
      const menuItem = db.prepare('SELECT recipe_id FROM menu_items WHERE id=? AND property_id=?').get(menuItemId, propertyId) as any;
      if (!menuItem || !menuItem.recipe_id) throw new Error('Menu item not found or has no recipe');

      const recipeIngredients = db.prepare(`
        SELECT ri.ingredient_id, ri.quantity_base_units, i.name
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id=?
      `).all(menuItem.recipe_id) as any[];

      db.prepare(`
        INSERT INTO service_logs (id,property_id,menu_item_id,quantity_prepared,logged_by,source)
        VALUES (?,?,?,?,?,?)
      `).run(logId, propertyId, menuItemId, quantityPrepared, loggedBy, source);

      const result: object[] = [];
      for (const ri of recipeIngredients) {
        const totalDeduction = ri.quantity_base_units * quantityPrepared;
        const txId = recordTransaction(propertyId, ri.ingredient_id, 'consume', -totalDeduction, loggedBy, {
          referenceId: logId,
          referenceType: 'service_log',
          notes: `Recipe consumption for ${quantityPrepared} portions`,
        });
        result.push({ ingredientId: ri.ingredient_id, name: ri.name, deductedBase: totalDeduction, transactionId: txId });
      }
      return result;
    })();

    refreshAlerts(propertyId);
    res.status(201).json({ serviceLogId: logId, deductions });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// GET /api/service-logs/:propertyId
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const { from, to } = req.query;
  let sql = `
    SELECT sl.id, sl.quantity_prepared, sl.logged_at, sl.source,
           m.name AS menuItemName, m.category, m.selling_price,
           u.name AS loggedByName
    FROM service_logs sl
    JOIN menu_items m ON m.id = sl.menu_item_id
    JOIN users u ON u.id = sl.logged_by
    WHERE sl.property_id = ?
  `;
  const params: string[] = [req.params.propertyId];
  if (from) { sql += ' AND sl.logged_at >= ?'; params.push(from as string); }
  if (to) { sql += ' AND sl.logged_at <= ?'; params.push(to as string); }
  sql += ' ORDER BY sl.logged_at DESC LIMIT 50';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/service-logs/pos-event — mock POS webhook
router.post('/pos-event', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, menuItemId, quantityPrepared, posOrderId } = req.body;

  // Find a chef for this property to attribute the log to
  const chef = db.prepare("SELECT id FROM users WHERE property_id=? AND role='chef' LIMIT 1").get(propertyId) as any;
  if (!chef) return res.status(400).json({ error: 'No chef found for property' });

  req.body = {
    propertyId,
    menuItemId,
    quantityPrepared,
    loggedBy: chef.id,
    source: 'pos_event',
  };

  // Delegate to main handler
  return (router as any).handle(req, res);
});

export default router;

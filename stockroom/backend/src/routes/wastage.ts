import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { recordTransaction, toBaseUnits } from '../services/stockLedger';
import { refreshAlerts } from '../services/alertService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/wastage — record wastage or spoilage (separate from consumption)
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, ingredientId, quantity, unit, reason, recordedBy } = req.body as {
    propertyId: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    reason: string;
    recordedBy: string;
  };

  if (!propertyId || !ingredientId || !quantity || !unit || !recordedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const quantityBase = toBaseUnits(ingredientId, quantity, unit);
    const logId = uuidv4();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO wastage_logs (id,property_id,ingredient_id,quantity_base_units,reason,logged_by)
        VALUES (?,?,?,?,?,?)
      `).run(logId, propertyId, ingredientId, quantityBase, reason, recordedBy);

      recordTransaction(propertyId, ingredientId, 'waste', -quantityBase, recordedBy, {
        referenceId: logId,
        referenceType: 'wastage_log',
        notes: reason,
      });
    })();

    refreshAlerts(propertyId);
    res.status(201).json({ wastageLogId: logId, quantityBase });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// GET /api/wastage/:propertyId — recent wastage logs
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT w.id, w.quantity_base_units, w.reason, w.logged_at,
           i.name AS ingredientName, i.base_unit, u.name AS loggedByName
    FROM wastage_logs w
    JOIN ingredients i ON i.id = w.ingredient_id
    JOIN users u ON u.id = w.logged_by
    WHERE w.property_id = ?
    ORDER BY w.logged_at DESC
    LIMIT 30
  `).all(req.params.propertyId);
  res.json(logs);
});

export default router;

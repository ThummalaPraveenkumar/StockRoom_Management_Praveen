import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { toBaseUnits, getAvailableUnits } from '../services/stockLedger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/purchase-requests — list (optionally filtered)
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, status } = req.query;
  let sql = `
    SELECT pr.id, pr.property_id, pr.ingredient_id, i.name AS ingredientName, i.base_unit,
           pr.requested_quantity_base_units, pr.approved_quantity_base_units, pr.display_unit,
           pr.status, pr.notes, pr.created_at, pr.updated_at,
           raiser.name AS raisedByName, raiser.role AS raisedByRole,
           approver.name AS approvedByName,
           p.name AS propertyName
    FROM purchase_requests pr
    JOIN ingredients i ON i.id = pr.ingredient_id
    JOIN users raiser ON raiser.id = pr.raised_by
    LEFT JOIN users approver ON approver.id = pr.approved_by
    JOIN properties p ON p.id = pr.property_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (propertyId) { sql += ' AND pr.property_id=?'; params.push(propertyId as string); }
  if (status) { sql += ' AND pr.status=?'; params.push(status as string); }
  sql += ' ORDER BY pr.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/purchase-requests — raise a request
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, ingredientId, quantity, unit, notes, raisedBy } = req.body;

  if (!propertyId || !ingredientId || !quantity || !unit || !raisedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const quantityBase = toBaseUnits(ingredientId, quantity, unit);
    const id = uuidv4();
    db.prepare(`
      INSERT INTO purchase_requests (id,property_id,ingredient_id,requested_quantity_base_units,display_unit,raised_by,notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, propertyId, ingredientId, quantityBase, unit, raisedBy, notes ?? null);
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// PUT /api/purchase-requests/:id — approve / adjust / reject
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { status, approvedQuantity, unit, approvedBy, notes } = req.body;

  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=?').get(req.params.id) as any;
  if (!pr) return res.status(404).json({ error: 'Not found' });
  if (!['approved','adjusted','rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, adjusted, or rejected' });
  }

  let approvedBase = pr.approved_quantity_base_units;
  if (approvedQuantity && unit) {
    try {
      approvedBase = toBaseUnits(pr.ingredient_id, approvedQuantity, unit);
    } catch (e) {
      return res.status(400).json({ error: String(e) });
    }
  }

  db.prepare(`
    UPDATE purchase_requests
    SET status=?, approved_quantity_base_units=?, approved_by=?, notes=COALESCE(?,notes), updated_at=datetime('now')
    WHERE id=?
  `).run(status, approvedBase, approvedBy, notes ?? null, req.params.id);

  res.json({ id: req.params.id, status });
});

export default router;

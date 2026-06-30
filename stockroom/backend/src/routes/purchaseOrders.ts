import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/purchase-orders?propertyId=... — list POs
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId } = req.query;
  let sql = `
    SELECT po.id, po.status, po.created_at, u.name AS createdByName, p.name AS propertyName,
      COUNT(poi.id) AS itemCount,
      SUM(poi.quantity_ordered_base_units * i.vendor_price_per_base_unit) AS estimatedValue
    FROM purchase_orders po
    JOIN users u ON u.id = po.created_by
    JOIN properties p ON p.id = po.property_id
    LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
    LEFT JOIN ingredients i ON i.id = poi.ingredient_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (propertyId) { sql += ' AND po.property_id=?'; params.push(propertyId as string); }
  sql += ' GROUP BY po.id ORDER BY po.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/purchase-orders — create PO from approved requests
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, requestIds, createdBy } = req.body as {
    propertyId: string;
    requestIds: string[];
    createdBy: string;
  };

  if (!propertyId || !requestIds?.length || !createdBy) {
    return res.status(400).json({ error: 'propertyId, requestIds, and createdBy are required' });
  }

  try {
    const poId = db.transaction(() => {
      const id = uuidv4();
      db.prepare('INSERT INTO purchase_orders (id,property_id,status,created_by) VALUES (?,?,?,?)')
        .run(id, propertyId, 'pending', createdBy);

      for (const requestId of requestIds) {
        const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=? AND property_id=?').get(requestId, propertyId) as any;
        if (!pr) continue;
        if (!['approved','adjusted'].includes(pr.status)) continue;

        const qty = pr.approved_quantity_base_units ?? pr.requested_quantity_base_units;
        db.prepare(`
          INSERT INTO purchase_order_items (id,po_id,ingredient_id,request_id,quantity_ordered_base_units,status)
          VALUES (?,?,?,?,?,'pending')
        `).run(uuidv4(), id, pr.ingredient_id, requestId, qty);

        db.prepare(`UPDATE purchase_requests SET status='ordered', updated_at=datetime('now') WHERE id=?`).run(requestId);
      }
      return id;
    })();

    res.status(201).json({ purchaseOrderId: poId });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/purchase-orders/chain — aggregate across all properties (for purchase manager)
router.get('/chain', (req: Request, res: Response) => {
  const db = getDb();

  // Current stock across all properties
  const stockByProperty = db.prepare(`
    SELECT p.id AS propertyId, p.name AS propertyName, i.name AS ingredientName,
      i.id AS ingredientId, i.base_unit, i.par_level_base_units,
      COALESCE(SUM(t.quantity_base_units), 0) AS currentStock
    FROM properties p
    CROSS JOIN ingredients i ON i.property_id = p.id
    LEFT JOIN stock_transactions t ON t.ingredient_id = i.id AND t.property_id = p.id
    GROUP BY p.id, i.id
    ORDER BY p.name, i.name
  `).all();

  // Pending requests
  const pendingRequests = db.prepare(`
    SELECT pr.id, pr.property_id, p.name AS propertyName, i.name AS ingredientName,
      pr.requested_quantity_base_units, pr.approved_quantity_base_units, i.base_unit,
      pr.status, pr.created_at, raiser.name AS raisedByName
    FROM purchase_requests pr
    JOIN properties p ON p.id = pr.property_id
    JOIN ingredients i ON i.id = pr.ingredient_id
    JOIN users raiser ON raiser.id = pr.raised_by
    WHERE pr.status IN ('approved','adjusted')
    ORDER BY pr.created_at DESC
  `).all();

  res.json({ stockByProperty, pendingRequests });
});

// GET /api/purchase-orders/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`
    SELECT poi.*, i.name AS ingredientName, i.base_unit, i.vendor_name
    FROM purchase_order_items poi
    JOIN ingredients i ON i.id = poi.ingredient_id
    WHERE poi.po_id=?
  `).all(req.params.id);
  res.json({ ...po, items });
});

export default router;

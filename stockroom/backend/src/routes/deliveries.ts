import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { recordTransaction, toBaseUnits } from '../services/stockLedger';
import { refreshAlerts } from '../services/alertService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface DeliveryItem {
  ingredientId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: string;
  status: 'complete' | 'partial' | 'short' | 'damaged';
  notes?: string;
}

// POST /api/deliveries — create a delivery receipt
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, purchaseOrderId, items, recordedBy } = req.body as {
    propertyId: string;
    purchaseOrderId?: string;
    items: DeliveryItem[];
    recordedBy: string;
  };

  if (!propertyId || !items?.length || !recordedBy) {
    return res.status(400).json({ error: 'propertyId, items, and recordedBy are required' });
  }

  const poId = purchaseOrderId || uuidv4();
  let po = db.prepare('SELECT id FROM purchase_orders WHERE id=?').get(poId);

  const doDelivery = db.transaction(() => {
    // Create or link to PO
    if (!po) {
      db.prepare(`INSERT INTO purchase_orders (id,property_id,status,created_by) VALUES (?,?,'partial',?)`).run(poId, propertyId, recordedBy);
    }

    const results: object[] = [];

    for (const item of items) {
      const quantityBase = toBaseUnits(item.ingredientId, item.receivedQuantity, item.unit);

      if (quantityBase > 0) {
        const txId = recordTransaction(
          propertyId,
          item.ingredientId,
          'receive',
          quantityBase,
          recordedBy,
          {
            referenceId: poId,
            referenceType: 'purchase_order',
            notes: item.notes ?? (item.status !== 'complete' ? `Delivery ${item.status}` : undefined),
          }
        );

        // Upsert PO item
        const existingItem = db.prepare('SELECT id FROM purchase_order_items WHERE po_id=? AND ingredient_id=?').get(poId, item.ingredientId) as { id: string } | undefined;
        if (existingItem) {
          db.prepare(`
            UPDATE purchase_order_items
            SET quantity_received_base_units = quantity_received_base_units + ?, status=?
            WHERE id=?
          `).run(quantityBase, item.status, existingItem.id);
        } else {
          const orderedBase = toBaseUnits(item.ingredientId, item.orderedQuantity, item.unit);
          db.prepare(`
            INSERT INTO purchase_order_items (id,po_id,ingredient_id,quantity_ordered_base_units,quantity_received_base_units,status)
            VALUES (?,?,?,?,?,?)
          `).run(uuidv4(), poId, item.ingredientId, orderedBase, quantityBase, item.status);
        }

        results.push({ ingredientId: item.ingredientId, transactionId: txId, quantityReceivedBase: quantityBase, status: item.status });
      }
    }

    // Update PO status
    const poItems = db.prepare('SELECT status FROM purchase_order_items WHERE po_id=?').all(poId) as { status: string }[];
    const allComplete = poItems.every(i => i.status === 'complete');
    const anyReceived = poItems.some(i => ['partial', 'complete'].includes(i.status));
    const newStatus = allComplete ? 'complete' : anyReceived ? 'partial' : 'pending';
    db.prepare('UPDATE purchase_orders SET status=? WHERE id=?').run(newStatus, poId);

    return results;
  });

  try {
    const results = doDelivery();
    refreshAlerts(propertyId);
    res.status(201).json({ purchaseOrderId: poId, items: results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/deliveries/:propertyId — list recent POs
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const orders = db.prepare(`
    SELECT po.id, po.status, po.created_at, u.name AS created_by_name,
      COUNT(poi.id) AS item_count
    FROM purchase_orders po
    JOIN users u ON u.id = po.created_by
    LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
    WHERE po.property_id = ?
    GROUP BY po.id
    ORDER BY po.created_at DESC
    LIMIT 20
  `).all(req.params.propertyId);
  res.json(orders);
});

// GET /api/deliveries/:propertyId/:poId — PO details
router.get('/:propertyId/:poId', (req: Request, res: Response) => {
  const db = getDb();
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=? AND property_id=?').get(req.params.poId, req.params.propertyId);
  if (!po) return res.status(404).json({ error: 'Not found' });

  const items = db.prepare(`
    SELECT poi.*, i.name AS ingredient_name, i.base_unit
    FROM purchase_order_items poi
    JOIN ingredients i ON i.id = poi.ingredient_id
    WHERE poi.po_id=?
  `).all(req.params.poId);

  res.json({ ...po, items });
});

export default router;

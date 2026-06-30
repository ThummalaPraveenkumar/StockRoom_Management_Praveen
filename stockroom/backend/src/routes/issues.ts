import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { recordTransaction, toBaseUnits, getStockBalance } from '../services/stockLedger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface IssueItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

// POST /api/issues — issue stock to kitchen
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId, items, recordedBy, issueSlipNumber } = req.body as {
    propertyId: string;
    items: IssueItem[];
    recordedBy: string;
    issueSlipNumber?: string;
  };

  if (!propertyId || !items?.length || !recordedBy) {
    return res.status(400).json({ error: 'propertyId, items, and recordedBy are required' });
  }

  const slipId = issueSlipNumber ?? `SLIP-${Date.now()}`;

  try {
    const results = db.transaction(() => {
      const out: object[] = [];
      for (const item of items) {
        const quantityBase = toBaseUnits(item.ingredientId, item.quantity, item.unit);
        const [balance] = getStockBalance(propertyId, item.ingredientId);
        if (!balance) throw new Error(`Ingredient ${item.ingredientId} not found`);
        if (balance.quantityBaseUnits < quantityBase) {
          throw new Error(`Insufficient stock for ${balance.name}: available ${balance.quantityBaseUnits.toFixed(0)} ${balance.baseUnit}, requested ${quantityBase.toFixed(0)} ${balance.baseUnit}`);
        }
        const txId = recordTransaction(propertyId, item.ingredientId, 'issue', -quantityBase, recordedBy, {
          referenceId: slipId,
          referenceType: 'issue_slip',
          notes: item.notes,
        });
        out.push({ ingredientId: item.ingredientId, transactionId: txId, quantityBase });
      }
      return out;
    })();

    res.status(201).json({ issueSlipId: slipId, items: results });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// GET /api/issues/:propertyId — recent issue slips
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const issues = db.prepare(`
    SELECT
      t.reference_id AS issueSlipId,
      t.recorded_at AS issuedAt,
      u.name AS issuedByName,
      COUNT(*) AS itemCount,
      SUM(ABS(t.quantity_base_units) * i.vendor_price_per_base_unit) AS estimatedValue
    FROM stock_transactions t
    JOIN users u ON u.id = t.recorded_by
    JOIN ingredients i ON i.id = t.ingredient_id
    WHERE t.property_id=? AND t.transaction_type='issue'
    GROUP BY t.reference_id, t.recorded_at, u.name
    ORDER BY t.recorded_at DESC
    LIMIT 20
  `).all(req.params.propertyId);
  res.json(issues);
});

export default router;

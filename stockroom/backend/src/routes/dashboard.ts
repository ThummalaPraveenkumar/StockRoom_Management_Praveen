import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { getStockBalance } from '../services/stockLedger';
import { getActiveAlerts, refreshAlerts } from '../services/alertService';

const router = Router();

// GET /api/dashboard/:propertyId — manager dashboard data
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId } = req.params;
  const { period = '7' } = req.query;
  const days = parseInt(period as string, 10) || 7;

  try {
    // Refresh alerts before returning
    refreshAlerts(propertyId);
    const alerts = getActiveAlerts(propertyId);
    const stockBalances = getStockBalance(propertyId);

    // Food cost: sum of (quantity used * price) for consume/issue/waste transactions
    const costByCategory = db.prepare(`
      SELECT i.category,
        SUM(ABS(t.quantity_base_units) * COALESCE(i.vendor_price_per_base_unit, 0)) AS totalCost
      FROM stock_transactions t
      JOIN ingredients i ON i.id = t.ingredient_id
      WHERE t.property_id=?
        AND t.transaction_type IN ('issue','consume','waste')
        AND t.recorded_at >= datetime('now', '-' || ? || ' days')
      GROUP BY i.category
      ORDER BY totalCost DESC
    `).all(propertyId, days) as { category: string; totalCost: number }[];

    const totalCost = costByCategory.reduce((s, c) => s + c.totalCost, 0);

    // Revenue estimate from service logs
    const revenue = db.prepare(`
      SELECT COALESCE(SUM(sl.quantity_prepared * COALESCE(m.selling_price, 0)), 0) AS total
      FROM service_logs sl
      JOIN menu_items m ON m.id = sl.menu_item_id
      WHERE sl.property_id=? AND sl.logged_at >= datetime('now', '-' || ? || ' days')
    `).get(propertyId, days) as { total: number };

    const foodCostPct = revenue.total > 0 ? (totalCost / revenue.total) * 100 : 0;

    // Top consumed items
    const topConsumed = db.prepare(`
      SELECT i.name, i.category, i.base_unit,
        SUM(ABS(t.quantity_base_units)) AS totalUsedBase,
        SUM(ABS(t.quantity_base_units) * COALESCE(i.vendor_price_per_base_unit, 0)) AS totalCost
      FROM stock_transactions t
      JOIN ingredients i ON i.id = t.ingredient_id
      WHERE t.property_id=? AND t.transaction_type IN ('issue','consume')
        AND t.recorded_at >= datetime('now', '-' || ? || ' days')
      GROUP BY i.id
      ORDER BY totalCost DESC
      LIMIT 8
    `).all(propertyId, days);

    // Wastage this period
    const wastage = db.prepare(`
      SELECT i.name, i.base_unit,
        SUM(ABS(t.quantity_base_units)) AS totalWastedBase,
        SUM(ABS(t.quantity_base_units) * COALESCE(i.vendor_price_per_base_unit, 0)) AS totalCost
      FROM stock_transactions t
      JOIN ingredients i ON i.id = t.ingredient_id
      WHERE t.property_id=? AND t.transaction_type='waste'
        AND t.recorded_at >= datetime('now', '-' || ? || ' days')
      GROUP BY i.id
      ORDER BY totalCost DESC
      LIMIT 8
    `).all(propertyId, days);

    // Pending approvals
    const pendingApprovals = db.prepare(`
      SELECT pr.id, i.name AS ingredientName, pr.requested_quantity_base_units, i.base_unit,
             u.name AS raisedByName, pr.created_at, pr.notes
      FROM purchase_requests pr
      JOIN ingredients i ON i.id = pr.ingredient_id
      JOIN users u ON u.id = pr.raised_by
      WHERE pr.property_id=? AND pr.status='pending'
      ORDER BY pr.created_at ASC
    `).all(propertyId);

    const stockSummary = {
      total: stockBalances.length,
      ok: stockBalances.filter(b => b.status === 'ok').length,
      low: stockBalances.filter(b => b.status === 'low').length,
      critical: stockBalances.filter(b => b.status === 'critical').length,
      breach: stockBalances.filter(b => b.status === 'breach').length,
    };

    res.json({
      propertyId,
      period: days,
      foodCostPct: Math.round(foodCostPct * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(revenue.total * 100) / 100,
      costByCategory,
      topConsumed,
      wastage,
      alerts,
      pendingApprovals,
      stockSummary,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;

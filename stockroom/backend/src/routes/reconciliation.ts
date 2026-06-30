import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';

const router = Router();

// GET /api/reconciliation/:propertyId — month-end variance report
router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const { propertyId } = req.params;
  const { from, to } = req.query;

  // Default to current month
  const fromDate = (from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const toDate = (to as string) || new Date().toISOString().slice(0, 10);

  try {
    // Theoretical consumption: from recipe × dishes prepared
    const theoretical = db.prepare(`
      SELECT
        ri.ingredient_id AS ingredientId,
        i.name AS ingredientName,
        i.base_unit,
        i.category,
        SUM(sl.quantity_prepared * ri.quantity_base_units) AS theoreticalBase
      FROM service_logs sl
      JOIN menu_items m ON m.id = sl.menu_item_id
      JOIN recipe_ingredients ri ON ri.recipe_id = m.recipe_id
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE sl.property_id = ?
        AND sl.logged_at BETWEEN ? AND datetime(?, '+1 day')
      GROUP BY ri.ingredient_id
    `).all(propertyId, fromDate, toDate) as any[];

    // Actual consumption: all outgoing transactions (issue + consume + waste)
    const actual = db.prepare(`
      SELECT
        t.ingredient_id AS ingredientId,
        i.name AS ingredientName,
        i.base_unit,
        i.category,
        SUM(ABS(t.quantity_base_units)) AS actualBase,
        SUM(CASE WHEN t.transaction_type='waste' THEN ABS(t.quantity_base_units) ELSE 0 END) AS wastageBase,
        SUM(CASE WHEN t.transaction_type='consume' THEN ABS(t.quantity_base_units) ELSE 0 END) AS consumedBase,
        SUM(CASE WHEN t.transaction_type='issue' THEN ABS(t.quantity_base_units) ELSE 0 END) AS issuedBase
      FROM stock_transactions t
      JOIN ingredients i ON i.id = t.ingredient_id
      WHERE t.property_id = ?
        AND t.transaction_type IN ('issue','consume','waste')
        AND t.recorded_at BETWEEN ? AND datetime(?, '+1 day')
      GROUP BY t.ingredient_id
    `).all(propertyId, fromDate, toDate) as any[];

    // Build reconciliation: merge theoretical vs actual
    const theoreticalMap = new Map(theoretical.map((t: any) => [t.ingredientId, t]));
    const actualMap = new Map(actual.map((a: any) => [a.ingredientId, a]));
    const allIds = new Set([...theoreticalMap.keys(), ...actualMap.keys()]);

    const rows: object[] = [];
    for (const id of allIds) {
      const th = theoreticalMap.get(id);
      const ac = actualMap.get(id);
      const theoreticalBase = th?.theoreticalBase ?? 0;
      const actualBase = ac?.actualBase ?? 0;
      const variance = actualBase - theoreticalBase;
      const variancePct = theoreticalBase > 0 ? (variance / theoreticalBase) * 100 : null;

      const ingredient = th || ac;
      const price = (db.prepare('SELECT vendor_price_per_base_unit FROM ingredients WHERE id=?').get(id) as any)?.vendor_price_per_base_unit ?? 0;

      rows.push({
        ingredientId: id,
        ingredientName: ingredient.ingredientName,
        baseUnit: ingredient.base_unit,
        category: ingredient.category,
        theoreticalBase,
        actualBase,
        wastageBase: ac?.wastageBase ?? 0,
        consumedBase: ac?.consumedBase ?? 0,
        issuedBase: ac?.issuedBase ?? 0,
        variance,
        variancePct: variancePct !== null ? Math.round(variancePct * 10) / 10 : null,
        varianceCost: Math.round(Math.abs(variance) * price * 100) / 100,
        explanation: '',
      });
    }

    // Summary
    const totalVarianceCost = rows.reduce((s: number, r: any) => s + r.varianceCost, 0);
    const overConsumed = rows.filter((r: any) => r.variance > r.theoreticalBase * 0.05);
    const underConsumed = rows.filter((r: any) => r.variance < -r.theoreticalBase * 0.05);

    res.json({
      propertyId,
      from: fromDate,
      to: toDate,
      rows: rows.sort((a: any, b: any) => Math.abs(b.variancePct ?? 0) - Math.abs(a.variancePct ?? 0)),
      summary: {
        totalVarianceCost: Math.round(totalVarianceCost * 100) / 100,
        overConsumedCount: overConsumed.length,
        underConsumedCount: underConsumed.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;

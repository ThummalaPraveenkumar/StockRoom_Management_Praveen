import { getDb } from '../db/database';
import { getStockBalance } from './stockLedger';
import { v4 as uuidv4 } from 'uuid';

export interface Alert {
  id: string;
  propertyId: string;
  ingredientId: string;
  ingredientName: string;
  alertType: string;
  message: string;
  daysUntilStockout: number | null;
  status: string;
  createdAt: string;
}

// Daily usage rate over last 7 days
function getDailyUsageRate(propertyId: string, ingredientId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(SUM(ABS(quantity_base_units)), 0) AS total
    FROM stock_transactions
    WHERE property_id = ? AND ingredient_id = ?
      AND transaction_type IN ('issue','consume','waste')
      AND recorded_at >= datetime('now', '-7 days')
  `).get(propertyId, ingredientId) as { total: number };
  return row.total / 7;
}

export function refreshAlerts(propertyId: string): Alert[] {
  const db = getDb();
  const balances = getStockBalance(propertyId);

  for (const b of balances) {
    if (b.status === 'ok') {
      // Resolve any existing alerts for this ingredient
      db.prepare(`UPDATE alerts SET status='resolved' WHERE property_id=? AND ingredient_id=? AND status='active'`).run(propertyId, b.ingredientId);
      continue;
    }

    const dailyUsage = getDailyUsageRate(propertyId, b.ingredientId);
    const daysUntilStockout = dailyUsage > 0 ? b.quantityBaseUnits / dailyUsage : null;

    let alertType: string;
    let message: string;

    const daysStr = daysUntilStockout !== null
      ? ` At current usage, stock runs out in ${daysUntilStockout.toFixed(1)} days.`
      : '';

    if (b.status === 'breach' || b.status === 'critical') {
      alertType = b.status === 'breach' ? 'breach_par' : 'critical';
      const displayQty = formatQuantity(b.quantityBaseUnits, b.baseUnit);
      const parQty = formatQuantity(b.parLevelBaseUnits, b.baseUnit);
      message = `${b.name} is critically low: ${displayQty} remaining (par: ${parQty}).${daysStr}`;
    } else {
      alertType = 'low_stock';
      const displayQty = formatQuantity(b.quantityBaseUnits, b.baseUnit);
      const parQty = formatQuantity(b.parLevelBaseUnits, b.baseUnit);
      message = `${b.name} is below par level: ${displayQty} remaining (par: ${parQty}).${daysStr}`;
    }

    // Check if there is already an active alert of this type
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE property_id=? AND ingredient_id=? AND alert_type=? AND status='active'
    `).get(propertyId, b.ingredientId, alertType);

    if (!existing) {
      db.prepare(`
        INSERT INTO alerts (id,property_id,ingredient_id,alert_type,message,days_until_stockout,status)
        VALUES (?,?,?,?,?,?,'active')
      `).run(uuidv4(), propertyId, b.ingredientId, alertType, message, daysUntilStockout);
    } else {
      // Update message and days
      db.prepare(`UPDATE alerts SET message=?, days_until_stockout=? WHERE id=?`).run(message, daysUntilStockout, (existing as { id: string }).id);
    }
  }

  return getActiveAlerts(propertyId);
}

export function getActiveAlerts(propertyId: string): Alert[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.id, a.property_id AS propertyId, a.ingredient_id AS ingredientId,
           i.name AS ingredientName, a.alert_type AS alertType,
           a.message, a.days_until_stockout AS daysUntilStockout,
           a.status, a.created_at AS createdAt
    FROM alerts a
    JOIN ingredients i ON i.id = a.ingredient_id
    WHERE a.property_id = ? AND a.status = 'active'
    ORDER BY a.alert_type DESC, a.created_at DESC
  `).all(propertyId) as Alert[];
}

function formatQuantity(qty: number, baseUnit: string): string {
  if (baseUnit === 'g') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(2)} kg` : `${qty.toFixed(0)} g`;
  }
  if (baseUnit === 'ml') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(2)} L` : `${qty.toFixed(0)} ml`;
  }
  return `${qty} ${baseUnit}`;
}

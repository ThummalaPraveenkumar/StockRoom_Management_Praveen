import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export interface StockBalance {
  ingredientId: string;
  propertyId: string;
  name: string;
  category: string;
  baseUnit: string;
  quantityBaseUnits: number;
  parLevelBaseUnits: number;
  reorderQtyBaseUnits: number;
  vendorName: string | null;
  vendorLeadTimeDays: number | null;
  vendorPricePerBaseUnit: number | null;
  status: 'ok' | 'low' | 'critical' | 'breach';
}

export interface TransactionRecord {
  id: string;
  propertyId: string;
  ingredientId: string;
  ingredientName: string;
  transactionType: string;
  quantityBaseUnits: number;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
}

// Stock balance is always derived from the ledger sum - never stored directly
export function getStockBalance(propertyId: string, ingredientId?: string): StockBalance[] {
  const db = getDb();
  const where = ingredientId ? 'AND i.id = ?' : '';
  const params: string[] = ingredientId ? [propertyId, ingredientId] : [propertyId];

  const rows = db.prepare(`
    SELECT
      i.id           AS ingredientId,
      i.property_id  AS propertyId,
      i.name,
      i.category,
      i.base_unit    AS baseUnit,
      i.par_level_base_units    AS parLevelBaseUnits,
      i.reorder_quantity_base_units AS reorderQtyBaseUnits,
      i.vendor_name  AS vendorName,
      i.vendor_lead_time_days AS vendorLeadTimeDays,
      i.vendor_price_per_base_unit AS vendorPricePerBaseUnit,
      COALESCE(SUM(t.quantity_base_units), 0) AS quantityBaseUnits
    FROM ingredients i
    LEFT JOIN stock_transactions t
      ON t.ingredient_id = i.id AND t.property_id = i.property_id
    WHERE i.property_id = ? ${where}
    GROUP BY i.id
    ORDER BY i.category, i.name
  `).all(...params) as StockBalance[];

  return rows.map(r => ({
    ...r,
    status: computeStatus(r.quantityBaseUnits, r.parLevelBaseUnits),
  }));
}

function computeStatus(qty: number, par: number): 'ok' | 'low' | 'critical' | 'breach' {
  if (qty <= 0) return 'breach';
  if (qty <= par * 0.25) return 'critical';
  if (qty <= par) return 'low';
  return 'ok';
}

export function recordTransaction(
  propertyId: string,
  ingredientId: string,
  transactionType: 'receive' | 'issue' | 'consume' | 'waste' | 'adjust',
  quantityBaseUnits: number,
  recordedBy: string,
  opts: { referenceId?: string; referenceType?: string; notes?: string } = {}
): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO stock_transactions
      (id, property_id, ingredient_id, transaction_type, quantity_base_units,
       reference_id, reference_type, notes, recorded_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id, propertyId, ingredientId, transactionType, quantityBaseUnits,
    opts.referenceId ?? null, opts.referenceType ?? null, opts.notes ?? null, recordedBy
  );
  return id;
}

export function getTransactionHistory(
  propertyId: string,
  ingredientId?: string,
  limit = 50
): TransactionRecord[] {
  const db = getDb();
  const where = ingredientId ? 'AND t.ingredient_id = ?' : '';
  const params: (string | number)[] = ingredientId
    ? [propertyId, ingredientId, limit]
    : [propertyId, limit];

  return db.prepare(`
    SELECT
      t.id, t.property_id AS propertyId, t.ingredient_id AS ingredientId,
      i.name AS ingredientName, t.transaction_type AS transactionType,
      t.quantity_base_units AS quantityBaseUnits,
      t.reference_id AS referenceId, t.reference_type AS referenceType,
      t.notes, t.recorded_by AS recordedBy, u.name AS recordedByName,
      t.recorded_at AS recordedAt
    FROM stock_transactions t
    JOIN ingredients i ON i.id = t.ingredient_id
    JOIN users u ON u.id = t.recorded_by
    WHERE t.property_id = ? ${where}
    ORDER BY t.recorded_at DESC
    LIMIT ?
  `).all(...params) as TransactionRecord[];
}

// Convert a quantity from a display unit to base units
export function toBaseUnits(ingredientId: string, quantity: number, fromUnit: string): number {
  const db = getDb();
  const ingredient = db.prepare('SELECT base_unit FROM ingredients WHERE id=?').get(ingredientId) as { base_unit: string } | undefined;
  if (!ingredient) throw new Error('Ingredient not found');

  if (fromUnit === ingredient.base_unit) return quantity;

  const conv = db.prepare('SELECT factor FROM unit_conversions WHERE ingredient_id=? AND from_unit=?').get(ingredientId, fromUnit) as { factor: number } | undefined;
  if (!conv) throw new Error(`No conversion from ${fromUnit} for ingredient ${ingredientId}`);
  return quantity * conv.factor;
}

// Convert from base units to a display unit
export function fromBaseUnits(ingredientId: string, quantityBase: number, toUnit: string): number {
  const db = getDb();
  const ingredient = db.prepare('SELECT base_unit FROM ingredients WHERE id=?').get(ingredientId) as { base_unit: string } | undefined;
  if (!ingredient) throw new Error('Ingredient not found');

  if (toUnit === ingredient.base_unit) return quantityBase;

  const conv = db.prepare('SELECT factor FROM unit_conversions WHERE ingredient_id=? AND from_unit=?').get(ingredientId, toUnit) as { factor: number } | undefined;
  if (!conv) throw new Error(`No conversion to ${toUnit} for ingredient ${ingredientId}`);
  return quantityBase / conv.factor;
}

export function getAvailableUnits(ingredientId: string): string[] {
  const db = getDb();
  const ingredient = db.prepare('SELECT base_unit FROM ingredients WHERE id=?').get(ingredientId) as { base_unit: string } | undefined;
  if (!ingredient) return [];
  const conversions = db.prepare('SELECT from_unit FROM unit_conversions WHERE ingredient_id=?').all(ingredientId) as { from_unit: string }[];
  return [ingredient.base_unit, ...conversions.map(c => c.from_unit)];
}

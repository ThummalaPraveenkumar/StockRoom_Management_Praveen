import { Router } from 'express';
import { getDb } from '../db/database';
import { getAvailableUnits } from '../services/stockLedger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/:propertyId', (req, res) => {
  const db = getDb();
  const ingredients = db.prepare(`
    SELECT id, name, category, base_unit, par_level_base_units, reorder_quantity_base_units,
           vendor_name, vendor_lead_time_days, vendor_price_per_base_unit
    FROM ingredients WHERE property_id=? ORDER BY category, name
  `).all(req.params.propertyId);
  res.json(ingredients);
});

router.get('/:propertyId/:id', (req, res) => {
  const db = getDb();
  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id=? AND property_id=?').get(req.params.id, req.params.propertyId);
  if (!ingredient) return res.status(404).json({ error: 'Not found' });
  const units = getAvailableUnits(req.params.id);
  res.json({ ...ingredient, availableUnits: units });
});

router.post('/:propertyId', (req, res) => {
  const db = getDb();
  const { name, category, base_unit, par_level_base_units, reorder_quantity_base_units,
          vendor_name, vendor_lead_time_days, vendor_price_per_base_unit, conversions } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO ingredients (id,property_id,name,category,base_unit,par_level_base_units,reorder_quantity_base_units,vendor_name,vendor_lead_time_days,vendor_price_per_base_unit)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.params.propertyId, name, category, base_unit, par_level_base_units, reorder_quantity_base_units,
         vendor_name, vendor_lead_time_days, vendor_price_per_base_unit);
  if (conversions && Array.isArray(conversions)) {
    for (const c of conversions) {
      db.prepare('INSERT INTO unit_conversions (id,ingredient_id,from_unit,factor) VALUES (?,?,?,?)').run(uuidv4(), id, c.unit, c.factor);
    }
  }
  res.status(201).json({ id });
});

router.put('/:propertyId/:id/par-level', (req, res) => {
  const db = getDb();
  const { parLevel, reorderPoint } = req.body;
  db.prepare(`
    UPDATE ingredients
    SET par_level_base_units = ?, reorder_quantity_base_units = ?
    WHERE id = ? AND property_id = ?
  `).run(parLevel, reorderPoint, req.params.id, req.params.propertyId);
  res.json({ ok: true });
});

export default router;

import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/:propertyId', (req: Request, res: Response) => {
  const db = getDb();
  const recipes = db.prepare(`
    SELECT r.id, r.name, r.category,
      COUNT(ri.id) AS ingredientCount
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE r.property_id = ?
    GROUP BY r.id
    ORDER BY r.category, r.name
  `).all(req.params.propertyId);
  res.json(recipes);
});

router.get('/:propertyId/:id', (req: Request, res: Response) => {
  const db = getDb();
  const recipe = db.prepare('SELECT * FROM recipes WHERE id=? AND property_id=?').get(req.params.id, req.params.propertyId);
  if (!recipe) return res.status(404).json({ error: 'Not found' });

  const ingredients = db.prepare(`
    SELECT ri.id, ri.quantity_base_units, i.id AS ingredientId, i.name, i.base_unit, i.category,
      COALESCE(SUM(st.quantity_base_units), 0) AS currentStock
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN stock_transactions st ON st.ingredient_id = i.id AND st.property_id = ?
    WHERE ri.recipe_id = ?
    GROUP BY ri.id
  `).all(req.params.propertyId, req.params.id);

  res.json({ ...recipe, ingredients });
});

// GET /api/recipes/:propertyId/menu-items/list
router.get('/:propertyId/menu-items/list', (req: Request, res: Response) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT m.id, m.name, m.category, m.selling_price, m.recipe_id, r.name AS recipeName
    FROM menu_items m
    LEFT JOIN recipes r ON r.id = m.recipe_id
    WHERE m.property_id = ?
    ORDER BY m.category, m.name
  `).all(req.params.propertyId);
  res.json(items);
});

export default router;

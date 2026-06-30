import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const properties = db.prepare('SELECT id, name, created_at FROM properties ORDER BY name').all();
  res.json(properties);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const property = db.prepare('SELECT id, name, created_at FROM properties WHERE id=?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Not found' });
  res.json(property);
});

router.get('/:id/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, role, property_id FROM users WHERE property_id=? OR property_id IS NULL ORDER BY role').all(req.params.id);
  res.json(users);
});

export default router;

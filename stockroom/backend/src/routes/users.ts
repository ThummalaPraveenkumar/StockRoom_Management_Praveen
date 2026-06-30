import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, role, property_id FROM users ORDER BY name').all();
  res.json(users);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, role, property_id FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

export default router;

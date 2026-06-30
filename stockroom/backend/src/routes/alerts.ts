import { Router, Request, Response } from 'express';
import { getDb } from '../db/database';
import { refreshAlerts, getActiveAlerts } from '../services/alertService';

const router = Router();

router.get('/:propertyId', (req: Request, res: Response) => {
  refreshAlerts(req.params.propertyId);
  res.json(getActiveAlerts(req.params.propertyId));
});

router.put('/:id/acknowledge', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE alerts SET status='acknowledged' WHERE id=?").run(req.params.id);
  res.json({ id: req.params.id, status: 'acknowledged' });
});

export default router;

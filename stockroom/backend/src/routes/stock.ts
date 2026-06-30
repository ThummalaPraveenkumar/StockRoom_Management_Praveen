import { Router } from 'express';
import { getStockBalance, getTransactionHistory, getAvailableUnits, fromBaseUnits } from '../services/stockLedger';
import { refreshAlerts } from '../services/alertService';

const router = Router();

// GET /api/stock/:propertyId — current balances
router.get('/:propertyId', (req, res) => {
  try {
    const balances = getStockBalance(req.params.propertyId);
    // Enrich with a human-friendly display quantity
    const enriched = balances.map(b => ({
      ...b,
      displayQuantity: formatQty(b.quantityBaseUnits, b.baseUnit),
      displayPar: formatQty(b.parLevelBaseUnits, b.baseUnit),
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/stock/:propertyId/:ingredientId — single ingredient balance
router.get('/:propertyId/:ingredientId', (req, res) => {
  try {
    const [balance] = getStockBalance(req.params.propertyId, req.params.ingredientId);
    if (!balance) return res.status(404).json({ error: 'Not found' });
    const units = getAvailableUnits(req.params.ingredientId);
    res.json({
      ...balance,
      displayQuantity: formatQty(balance.quantityBaseUnits, balance.baseUnit),
      displayPar: formatQty(balance.parLevelBaseUnits, balance.baseUnit),
      availableUnits: units,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/stock/:propertyId/:ingredientId/history — ledger entries
router.get('/:propertyId/:ingredientId/history', (req, res) => {
  try {
    const history = getTransactionHistory(req.params.propertyId, req.params.ingredientId);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/stock/:propertyId/alerts/refresh — recompute alerts
router.post('/:propertyId/alerts/refresh', (req, res) => {
  try {
    const alerts = refreshAlerts(req.params.propertyId);
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

function formatQty(qty: number, baseUnit: string): string {
  if (baseUnit === 'g') return qty >= 1000 ? `${(qty / 1000).toFixed(2)} kg` : `${qty.toFixed(0)} g`;
  if (baseUnit === 'ml') return qty >= 1000 ? `${(qty / 1000).toFixed(2)} L` : `${qty.toFixed(0)} ml`;
  return `${qty} ${baseUnit}`;
}

export default router;

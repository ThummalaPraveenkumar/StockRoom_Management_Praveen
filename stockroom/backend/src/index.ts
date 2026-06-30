import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initSchema, seedData } from './db/database';

import propertiesRouter from './routes/properties';
import usersRouter from './routes/users';
import stockRouter from './routes/stock';
import ingredientsRouter from './routes/ingredients';
import deliveriesRouter from './routes/deliveries';
import issuesRouter from './routes/issues';
import wastageRouter from './routes/wastage';
import recipesRouter from './routes/recipes';
import purchaseRequestsRouter from './routes/purchaseRequests';
import purchaseOrdersRouter from './routes/purchaseOrders';
import serviceLogsRouter from './routes/serviceLogs';
import dashboardRouter from './routes/dashboard';
import reconciliationRouter from './routes/reconciliation';
import alertsRouter from './routes/alerts';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Attach io to request so routes can emit events
app.use((req: any, _res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/stock', stockRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/wastage', wastageRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/purchase-requests', purchaseRequestsRouter);
app.use('/api/purchase-orders', purchaseOrdersRouter);
app.use('/api/service-logs', serviceLogsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reconciliation', reconciliationRouter);
app.use('/api/alerts', alertsRouter);

// Mock POS event endpoint (stretch goal)
app.post('/api/pos/dish-prepared', async (req, res) => {
  const { propertyId, menuItemId, quantityPrepared } = req.body;
  try {
    const response = await fetch(`http://localhost:${PORT}/api/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, menuItemId, quantityPrepared, source: 'pos_event' }),
    });
    const data = await response.json();
    io.emit('stock_updated', { propertyId, source: 'pos_event' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// WebSocket: emit stock_updated when mutations happen
// This wraps the response to detect successful mutations
const originalJson = express.response.json;
(express.response as any).json = function (body: unknown) {
  const req = this.req as any;
  if (req.method !== 'GET' && this.statusCode < 300) {
    const mutatingPaths = ['/api/deliveries', '/api/issues', '/api/wastage', '/api/service-logs'];
    const isMutating = mutatingPaths.some(p => req.path.startsWith(p));
    if (isMutating && req.body?.propertyId) {
      io.emit('stock_updated', { propertyId: req.body.propertyId });
    }
    if (req.path.startsWith('/api/purchase-requests') && req.method !== 'GET') {
      io.emit('purchase_request_updated', { propertyId: req.body?.propertyId });
    }
  }
  return originalJson.call(this, body);
};

io.on('connection', (socket) => {
  console.log('[ws] client connected:', socket.id);
  socket.on('join_property', (propertyId: string) => {
    socket.join(`property:${propertyId}`);
  });
  socket.on('disconnect', () => {
    console.log('[ws] client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

initSchema();
seedData();

httpServer.listen(PORT, () => {
  console.log(`[server] StockRoom API running on http://localhost:${PORT}`);
});

export { io };

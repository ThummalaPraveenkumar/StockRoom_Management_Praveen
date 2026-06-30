# StockRoom_Management_Praveen
StockRoom — Hotel Raw Material Management
A full-stack hotel inventory management system built for a 6-hour buildathon. Four role-specific surfaces share one immutable stock ledger with real-time sync across all connected clients.


What It Does
Hotels lose margins to three things: over-ordering, untracked wastage, and reconciliation blind spots. StockRoom gives each role in the F&B chain their own purpose-built interface while keeping a single, tamper-proof stock ledger underneath.

Surface
Role
Access
Store App
Store Keeper (Kavitha)
Receive deliveries, issue stock, record wastage, run physical counts
Chef View
Head Chef (Ramesh)
Live stock levels, recipe feasibility, log dishes prepared, raise purchase requests
Manager Dashboard
F&B Manager (Arjun)
KPIs, approve requests, month-end reconciliation, par level management
Purchase Console
Purchase Manager (Meena)
Chain-wide stock view, consolidate approved requests, create vendor orders



Key Technical Design Decisions
Immutable Stock Ledger
Stock balance is never stored — it is always computed as:

SELECT SUM(quantity_base_units) FROM stock_transactions

WHERE property_id = ? AND ingredient_id = ?

Every receive, issue, consume, wastage, and adjustment is an INSERT-only row. The ledger cannot drift, overwrite, or be reconciled incorrectly.
Unit Conversion at the API Boundary
All quantities are stored in base units (grams, millilitres, pieces). The unit_conversions table stores a factor per ingredient per display unit. Input in kg → stored as g. Recipes define portions in grams; service logs convert automatically.
Multi-Tenancy
Every table carries a property_id column. The purchase manager's user record has property_id = NULL — she queries across all properties with a CROSS JOIN aggregation.
Real-Time Sync
Socket.io broadcasts a stock_updated event after every mutating API call. Each frontend surface listens and calls React Query's invalidateQueries on receipt — no polling, no manual refresh.
Offline Support
The Store App uses an IndexedDB queue (lib/offline.ts). When the browser goes offline, mutations are captured locally. On reconnect, they sync automatically with a pending count shown in the header.


Tech Stack
Backend

Node.js + Express (TypeScript)
SQLite via better-sqlite3 (synchronous, WAL mode)
Socket.io for real-time events
uuid for all primary keys

Frontend

React 18 + TypeScript + Vite
React Router v6
TanStack React Query v5 (stale time 30s, background refetch)
Socket.io-client
Lucide React icons
IndexedDB for offline queue
Pure CSS design system (no UI component library)


Project Structure
stockroom/

├── backend/

│   └── src/

│       ├── db/

│       │   └── database.ts          # Schema creation + seed data

│       ├── services/

│       │   ├── stockLedger.ts       # Core balance, unit conversion, transaction recording

│       │   └── alertService.ts      # Alert generation, days-until-stockout

│       ├── routes/

│       │   ├── deliveries.ts        # POST /api/deliveries

│       │   ├── issues.ts            # POST /api/issues

│       │   ├── wastage.ts           # POST /api/wastage

│       │   ├── stock.ts             # GET  /api/stock/:propertyId

│       │   ├── ingredients.ts       # GET/POST/PUT /api/ingredients

│       │   ├── serviceLogs.ts       # POST /api/service-logs

│       │   ├── recipes.ts           # GET  /api/recipes

│       │   ├── purchaseRequests.ts  # GET/POST/PUT /api/purchase-requests

│       │   ├── purchaseOrders.ts    # GET/POST /api/purchase-orders

│       │   ├── dashboard.ts         # GET  /api/dashboard/:propertyId

│       │   ├── reconciliation.ts    # GET  /api/reconciliation/:propertyId

│       │   └── alerts.ts            # GET  /api/alerts/:propertyId

│       └── index.ts                 # Express + Socket.io server

│

├── frontend/

│   └── src/

│       ├── pages/

│       │   ├── Home.tsx             # Landing page — 4 surface cards

│       │   ├── StoreApp.tsx         # Store keeper: receive, issue, wastage, adjust, history

│       │   ├── ChefView.tsx         # Chef: stock, recipes, log dish, raise request

│       │   ├── ManagerDashboard.tsx # Manager: overview, alerts, approvals, reconciliation, par levels

│       │   └── PurchaseConsole.tsx  # Purchase: chain stock, approved requests, orders

│       ├── components/

│       │   ├── StockCard.tsx        # Ingredient card with progress bar + status stripe

│       │   ├── LedgerDrawer.tsx     # Slide-in full transaction history per ingredient

│       │   ├── Toast.tsx            # Toast notification container

│       │   └── Skeleton.tsx         # Loading skeleton cards

│       ├── hooks/

│       │   └── useToast.tsx         # Toast context + useReducer

│       └── lib/

│           ├── api.ts               # All fetch calls to the backend

│           ├── socket.ts            # Socket.io singleton + joinProperty

│           └── offline.ts           # IndexedDB queue for offline mutations

│

├── package.json                     # Root — concurrently runs both servers

├── start.sh                         # One-command startup script

└── README.md


Getting Started
Prerequisites
Node.js 18 or higher
npm 9 or higher
1. Clone the repository
git clone https://github.com/<your-username>/stockroom.git

cd stockroom
2. Install dependencies
# Install root, backend, and frontend dependencies

npm run install:all

Or manually:

cd backend && npm install

cd ../frontend && npm install
3. Start the development servers
Option A — one command from root:

npm run dev

Option B — shell script (also auto-installs if needed):

chmod +x start.sh

./start.sh

Option C — manually in two terminals:

# Terminal 1

cd backend && npm run dev

# Terminal 2

cd frontend && npm run dev

The database (backend/stockroom.db) is created automatically on first start with seed data for two properties and realistic stock levels.
4. Open in browser
URL
Surface
http://localhost:5173
Home — pick a surface
http://localhost:5173/store
Store App
http://localhost:5173/chef
Chef View
http://localhost:5173/manager
Manager Dashboard
http://localhost:5173/purchase
Purchase Console


Backend API runs on http://localhost:3001. Vite proxies /api and /socket.io requests automatically.


Seed Data
The database seeds automatically on first run:

2 Properties — Bay View Hotel Goa, The Regency Mumbai
7 Users — one store keeper, chef, and manager per property; one shared purchase manager
19 Ingredients across Grains, Liquids, Oils, Seafood, Spices, Vegetables, Dairy
Realistic stock levels — several ingredients seeded at LOW or CRITICAL to demonstrate the alert system
4 Recipes — Butter Chicken, Prawn Curry, Dal Makhani, Paneer Tikka
Service logs (consumption history) to populate reconciliation reports
1 pending + 1 approved purchase request — ready to demo the approval workflow


API Endpoints
Method
Endpoint
Description
GET
/api/properties
List all properties
GET
/api/stock/:propertyId
Stock balance for all ingredients
GET
/api/stock/:propertyId/:id/history
Full ledger history for one ingredient
POST
/api/deliveries
Record incoming delivery (receive transaction)
POST
/api/issues
Issue stock to a department
POST
/api/wastage
Record wastage with reason
POST
/api/service-logs
Log dish prepared — auto-deducts recipe ingredients
POST
/api/pos/dish-prepared
Mock POS webhook trigger
GET
/api/recipes/:propertyId
List recipes with ingredient counts
GET
/api/recipes/:propertyId/:id
Recipe detail with feasibility data
GET
/api/purchase-requests
List purchase requests (filter by propertyId, status)
POST
/api/purchase-requests
Raise a new purchase request
PUT
/api/purchase-requests/:id
Approve / reject a request
GET
/api/purchase-orders/chain
Chain-wide stock + pending requests
POST
/api/purchase-orders
Create a vendor purchase order
GET
/api/dashboard/:propertyId
Food cost %, top consumed, stock health, KPIs
GET
/api/reconciliation/:propertyId
Theoretical vs actual variance report
GET
/api/alerts/:propertyId
Active stock alerts with days-until-stockout
PUT
/api/ingredients/:propertyId/:id/par-level
Update par level and reorder point



Core Features
Stock Ledger Drill-Down
Click any ingredient on the Chef View stock tab or Store App history tab to open a slide-in ledger drawer. Every transaction is listed with its type (receive / issue / consume / waste / adjust), quantity with sign, who recorded it, timestamp, and notes. Nothing is editable — the audit trail is permanent.
Recipe Feasibility Calculator
The Chef View recipes tab shows how many portions can be prepared right now from current stock. Change the "plan for" number — any ingredient that falls short highlights in red with the exact shortfall.
Physical Count (Month-End Reconciliation)
The Store App Adjust tab shows all ingredients. The store keeper enters physically counted quantities. The system computes the difference against the ledger balance and records adjustment transactions — no manual variance math.
Par Level Management
The Manager Dashboard Par Levels tab lets the F&B manager set par levels and reorder points inline. Alert thresholds recalculate automatically:

Below reorder point → Low
Below 25% of par level → Critical
Below zero → Breach (stockout)
Offline Queue
The Store App header shows a Wi-Fi indicator and a count of pending operations. When the device goes offline (or the backend is unreachable), mutations queue in IndexedDB and sync when connectivity is restored.
Mock POS Integration
The Chef View Log Dish tab has a "Mock POS Event" toggle. When enabled, the dish-prepared action routes through /api/pos/dish-prepared — simulating an automated trigger from a real point-of-sale system.


Database Schema (13 tables)
properties          — property_id, name, city

users               — user_id, property_id (null = chain-wide), role, name

ingredients         — ingredient_id, property_id, name, category, base_unit,

                      par_level_base_units, reorder_quantity_base_units,

                      vendor_name, vendor_lead_time_days, vendor_price_per_base_unit

unit_conversions    — ingredient_id, from_unit, factor (factor × input = base units)

stock_transactions  — immutable ledger: ingredient_id, type, quantity_base_units,

                      recorded_by, reference, notes, created_at

purchase_requests   — ingredient_id, quantity, unit, status, raised_by, notes

purchase_orders     — po_number, vendor_name, property_id, status, expected_delivery

purchase_order_items— po_id, ingredient_id, quantity, unit, unit_price

recipes             — recipe_id, property_id, name, category

recipe_ingredients  — recipe_id, ingredient_id, quantity_base_units

menu_items          — menu_item_id, recipe_id, name

service_logs        — menu_item_id, property_id, quantity_prepared, logged_by

alerts              — ingredient_id, property_id, alert_type, message,

                      days_until_stockout, is_active


Functional Requirements Coverage
Requirement
Implementation
Raw material tracking per property
property_id scoped on every table and query
Immutable stock ledger
INSERT-only stock_transactions, balance via SUM
Unit conversions
unit_conversions table, converted at API boundary
Multi-tenancy
Property selector on each surface, NULL property_id for chain users
Real-time updates
Socket.io stock_updated event + React Query invalidation
Offline support
IndexedDB mutation queue in lib/offline.ts
Purchase request workflow
Chef → Manager approval → Purchase order creation
Reconciliation
Theoretical (recipe × service logs) vs actual (ledger) variance
Par level alerts
Configurable per ingredient, days-until-stockout from usage rate
Physical count
Adjust tab in Store App records variance as adjustment transactions
Mock POS integration
POST /api/pos/dish-prepared endpoint + toggle in Chef View



Screenshots
Add screenshots of each surface here after deployment.

/screenshots

  home.png

  store-receive.png

  chef-stock.png

  chef-ledger.png

  manager-overview.png

  manager-reconciliation.png

  purchase-chain.png


Built With
This project was built end-to-end during a 6-hour buildathon. No UI component libraries were used — all components, the design system, and the CSS token system are hand-written.


License
MIT


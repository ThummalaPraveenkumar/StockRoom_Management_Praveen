import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { getSocket } from './lib/socket';
import { syncPendingOps } from './lib/offline';
import Home from './pages/Home';
import StoreApp from './pages/StoreApp';
import ChefView from './pages/ChefView';
import ManagerDashboard from './pages/ManagerDashboard';
import PurchaseConsole from './pages/PurchaseConsole';

export default function App() {
  useEffect(() => {
    const socket = getSocket();
    socket.on('connect', () => {
      // Sync any pending offline operations on reconnect
      syncPendingOps().then(({ synced }) => {
        if (synced > 0) console.log(`[offline] Synced ${synced} pending operations`);
      });
    });
    window.addEventListener('online', () => {
      syncPendingOps().then(({ synced }) => {
        if (synced > 0) console.log(`[offline] Synced ${synced} pending operations`);
      });
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/store" element={<StoreApp />} />
        <Route path="/chef" element={<ChefView />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/purchase" element={<PurchaseConsole />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import ShopsPage from './pages/ShopsPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import SalesLogPage from './pages/SalesLogPage';
import ReportsPage from './pages/ReportsPage';
import POSPage from './pages/POSPage';
import ProfilePage from './pages/ProfilePage';
import KhataPage from './pages/KhataPage';
import PurchaseLedgerPage from './pages/PurchaseLedgerPage';
import PurchaseDetailsPage from './pages/PurchaseDetailsPage';
import SupplierLedgerPage from './pages/SupplierLedgerPage';
import GovSalesLogPage from './pages/GovSalesLogPage';
import GovReportsPage from './pages/GovReportsPage';
import StockLedgerPage from './pages/StockLedgerPage';

import { InstallProvider } from './context/InstallContext';
import { ToastProvider } from './context/ToastContext';

function App() {
  useEffect(() => {
    if (!window.visualViewport) return;
    
    const onResize = () => {
      const height = window.visualViewport.height;
      const viewportHeight = window.innerHeight;
      const offset = Math.max(0, viewportHeight - height);
      document.documentElement.style.setProperty('--keyboard-height', `${offset}px`);
      
      if (offset > 100) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };
    
    window.visualViewport.addEventListener('resize', onResize);
    window.visualViewport.addEventListener('scroll', onResize);
    return () => {
      window.visualViewport.removeEventListener('resize', onResize);
      window.visualViewport.removeEventListener('scroll', onResize);
    };
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <SyncProvider>
          <InstallProvider>
            <Router>
                <Routes>
                  {/* Public Routes - Only accessible when NOT logged in */}
                  <Route element={<PublicRoute />}>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                  </Route>
    
                  {/* Protected Routes - Only accessible when logged in */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      {/* Business Level - My Businesses */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<BusinessDashboard />} />
                      <Route path="/shops" element={<ShopsPage />} />
                      
                      {/* Shop Specific Routes - Strictly for ONE shop */}
                      <Route path="/shop/:shopId/dashboard" element={<Dashboard />} />
                      <Route path="/shop/:shopId/inventory" element={<InventoryPage />} />
                      <Route path="/shop/:shopId/inventory/:productId/ledger" element={<StockLedgerPage />} />
                      <Route path="/shop/:shopId/pos" element={<POSPage />} />
                      <Route path="/shop/:shopId/sales" element={<SalesPage />} />
                      <Route path="/shop/:shopId/sales-log" element={<SalesLogPage />} />
                      <Route path="/shop/:shopId/reports" element={<ReportsPage />} />
                      <Route path="/shop/:shopId/khata" element={<KhataPage />} />
                      <Route path="/shop/:shopId/purchase-ledger" element={<PurchaseLedgerPage />} />
                      <Route path="/shop/:shopId/purchase-ledger/:purchaseId" element={<PurchaseDetailsPage />} />
                      <Route path="/shop/:shopId/suppliers/:supplierName" element={<SupplierLedgerPage />} />
                      
                      {/* Government Records Routes */}
                      <Route path="/shop/:shopId/gov-sales-log" element={<GovSalesLogPage />} />
                      <Route path="/shop/:shopId/gov-reports" element={<GovReportsPage />} />
                      
                      <Route path="/profile" element={<ProfilePage />} />
                    </Route>
                  </Route>
    
                {/* Redirect all unknown routes to landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </InstallProvider>
        </SyncProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

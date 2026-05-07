import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';

import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './components/app/AppLayout';

// App pages
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Scraper from './pages/Scraper';
import MarketplaceInsights from './pages/MarketplaceInsights';
import ProductDetails from './pages/ProductDetails';
import StrategyBuilder from './pages/StrategyBuilder';
import IntelligenceHub from './pages/IntelligenceHub';
import MLPredictions from './pages/MLPredictions';

/** Wraps a page in <AppLayout>. ProtectedRoute is a no-op passthrough. */
function AppPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProductProvider>
          <ScrollToTop />
          <Routes>
            {/* ── Redirect root to dashboard ─────────────────────── */}
            <Route path="/" element={<Navigate to="/app" replace />} />

            {/* ── App routes ─────────────────────────────────────── */}
            <Route path="/app"                  element={<AppPage><Dashboard /></AppPage>} />
            <Route path="/app/analytics"        element={<AppPage><Analytics /></AppPage>} />
            <Route path="/app/intelligence"     element={<AppPage><IntelligenceHub /></AppPage>} />
            <Route path="/app/strategy"         element={<AppPage><StrategyBuilder /></AppPage>} />
            <Route path="/app/scraper"          element={<AppPage><Scraper /></AppPage>} />
            <Route path="/app/marketplace"      element={<AppPage><MarketplaceInsights /></AppPage>} />
            <Route path="/app/products/:id"     element={<AppPage><ProductDetails /></AppPage>} />
            <Route path="/app/ml"               element={<AppPage><MLPredictions /></AppPage>} />

            {/* ── Fallback ──────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </ProductProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

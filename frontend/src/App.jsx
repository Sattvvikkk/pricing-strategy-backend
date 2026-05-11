import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ProductProvider } from './context/ProductContext';
import { BuiltMarketplacesProvider } from './context/BuiltMarketplacesContext';

import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './components/app/AppLayout';

// App pages
import Overview from './pages/Overview';
import PricingEngine from './pages/PricingEngine';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Scraper from './pages/Scraper';
import MarketplaceInsights from './pages/MarketplaceInsights';
import ProductDetails from './pages/ProductDetails';
import StrategyBuilder from './pages/StrategyBuilder';
import IntelligenceHub from './pages/IntelligenceHub';
import MLPredictions from './pages/MLPredictions';
import CompetitorReaction from './pages/CompetitorReaction';
import InventoryOptimization from './pages/InventoryOptimization';
import CustomerSegmentation from './pages/CustomerSegmentation';
import AICopilot from './pages/AICopilot';
import ScenarioSimulator from './pages/ScenarioSimulator';
import IntelligencePipeline from './pages/IntelligencePipeline';
import MarketplaceIntelligence from './pages/MarketplaceIntelligence';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
import Landing from './pages/Landing';

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
          <BuiltMarketplacesProvider>
          <ScrollToTop />
          <Routes>
            {/* ── Landing page with Enter button ──────────────────── */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* ── App routes ─────────────────────────────────────── */}
            <Route path="/app"                  element={<AppPage><Overview /></AppPage>} />
            <Route path="/app/dashboard"        element={<AppPage><Dashboard /></AppPage>} />
            <Route path="/app/analytics"        element={<AppPage><Analytics /></AppPage>} />
            <Route path="/app/intelligence"     element={<AppPage><MarketplaceIntelligence /></AppPage>} />
            <Route path="/app/strategy"         element={<AppPage><StrategyBuilder /></AppPage>} />
            <Route path="/app/pricing-engine"   element={<AppPage><PricingEngine /></AppPage>} />
            <Route path="/app/scraper"          element={<AppPage><Scraper /></AppPage>} />
            <Route path="/app/marketplace"      element={<AppPage><MarketplaceInsights /></AppPage>} />
            <Route path="/app/products/:id"     element={<AppPage><ProductDetails /></AppPage>} />
            <Route path="/app/ml"               element={<AppPage><MLPredictions /></AppPage>} />
            <Route path="/app/competitor-reaction" element={<AppPage><CompetitorReaction /></AppPage>} />
            <Route path="/app/inventory"           element={<AppPage><InventoryOptimization /></AppPage>} />
            <Route path="/app/segments"           element={<AppPage><CustomerSegmentation /></AppPage>} />
            <Route path="/app/ai-copilot"         element={<AppPage><AICopilot /></AppPage>} />
            <Route path="/app/simulator"          element={<AppPage><ScenarioSimulator /></AppPage>} />
            <Route path="/app/pipeline"           element={<AppPage><IntelligencePipeline /></AppPage>} />
            <Route path="/app/automations"        element={<AppPage><Automations /></AppPage>} />
            <Route path="/app/settings"           element={<AppPage><Settings /></AppPage>} />

            {/* ── Fallback ──────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
          </BuiltMarketplacesProvider>
        </ProductProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProductProvider } from './context/ProductContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import MarketplaceInsights from './pages/MarketplaceInsights';
import ProductDetails from './pages/ProductDetails';
import Scraper from './pages/Scraper';

function AppLayout({ children }) {
  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProductProvider>
        <Routes>
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
          <Route path="/marketplace" element={<AppLayout><MarketplaceInsights /></AppLayout>} />
          <Route path="/product" element={<AppLayout><ProductDetails /></AppLayout>} />
          <Route path="/scraper" element={<AppLayout><Scraper /></AppLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProductProvider>
    </BrowserRouter>
  );
}

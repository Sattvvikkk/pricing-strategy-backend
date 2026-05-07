import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/client';

const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [catalog, setCatalog] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Fetch the full 20-product catalog from the backend. */
  const refreshCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/api/products');
      const products = res.data.products || [];
      setCatalog(products);
      // Default to first product if nothing is selected yet
      setActiveProduct((prev) => prev || products[0] || null);
    } catch (err) {
      console.error('Failed to load product catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetch catalog on mount. */
  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  return (
    <ProductContext.Provider value={{
      catalog,
      activeProduct,
      setActiveProduct,
      loading,
      refreshCatalog,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProduct = () => useContext(ProductContext);

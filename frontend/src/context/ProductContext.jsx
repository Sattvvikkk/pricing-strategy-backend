import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/client';

const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const [catalog, setCatalog] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

  // Load catalog on mount
  useEffect(() => {
    API.get('/api/products/catalog')
      .then(res => {
        setCatalog(res.data.products);
        // Default to first product (H&M t-shirt)
        if (res.data.products.length > 0) {
          selectProduct(res.data.products[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const selectProduct = useCallback((productId) => {
    setDetailLoading(true);
    setUrlError('');
    API.get(`/api/products/detail/${productId}`)
      .then(res => {
        setActiveProduct(res.data.product);
        setProductDetail(res.data.product);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }, []);

  const lookupByUrl = useCallback((url) => {
    if (!url.trim()) return;
    setLoading(true);
    setUrlError('');
    API.post('/api/products/lookup', { url })
      .then(res => {
        setActiveProduct(res.data.product);
        setProductDetail(res.data.product);
        setLoading(false);
        setUrlInput('');
      })
      .catch((err) => {
        setUrlError('Could not find product for this URL');
        setLoading(false);
      });
  }, []);

  return (
    <ProductContext.Provider value={{
      catalog,
      activeProduct,
      productDetail,
      loading,
      detailLoading,
      urlInput,
      setUrlInput,
      urlError,
      selectProduct,
      lookupByUrl,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export const useProduct = () => useContext(ProductContext);

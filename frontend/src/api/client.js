import axios from 'axios';

/**
 * Axios instance.
 * In dev: Vite proxy forwards /api/* → http://localhost:8000
 * In prod: VITE_API_URL points at the Render backend
 * baseURL is intentionally empty so /api/... paths work in both environments.
 */
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

export default API;

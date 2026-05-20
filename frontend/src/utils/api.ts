const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const API_URL = (import.meta as any).env.VITE_API_URL || `http://${fallbackHost}:3001`;

export default API_URL;
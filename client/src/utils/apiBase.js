/**
 * Dynamically resolves the API base URL.
 * - In local development on localhost/127.0.0.1: points to http://localhost:4000
 * - When accessed across local Wi-Fi / Fire TV (e.g. 192.168.x.x:3001): routes to http://<LAN-IP>:4000
 * - When in production (Render / custom domain): uses configured VITE_API_BASE
 */
export function getApiBase() {
  // 1. If in browser on LAN IP (e.g. Fire TV testing via 192.168.x.x:3001), route to port 4000 on the same host
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1" && !host.includes("onrender.com")) {
      return `http://${host}:4000`;
    }
  }

  const envBase = (import.meta.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "");

  // 2. If running in production (e.g. on Render or custom domain), use configured base
  if (envBase && !envBase.includes("localhost") && !envBase.includes("127.0.0.1")) {
    return envBase;
  }

  return envBase || "http://localhost:4000";
}

export const API_BASE = getApiBase();

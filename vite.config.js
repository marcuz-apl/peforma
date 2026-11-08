import { defineConfig } from 'vite';

// Bind to every interface (IPv4 + IPv6) and accept any Host header so the dev
// server is reachable via localhost, 127.0.0.1, the LAN IP, and the machine
// hostname. allowedHosts:true disables Vite's host guard, which is appropriate
// for a trusted local/LAN dev tool that never uploads source data.
export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },
});
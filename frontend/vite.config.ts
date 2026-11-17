import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('qrcode') || id.includes('clsx')) return 'vendor-utils';
            return 'vendor-libs';
          }
          if (
            id.includes('/pages/Management') ||
            id.includes('/pages/Alerts') ||
            id.includes('/pages/Fee') ||
            id.includes('/pages/Block') ||
            id.includes('/pages/RoomManagement') ||
            id.includes('/pages/MessManagement') ||
            id.includes('/pages/GuestBilling') ||
            id.includes('/pages/OutingApprovals')
          ) {
            return 'portal-management';
          }
          if (
            id.includes('/pages/Dashboard') ||
            id.includes('/pages/MyRoom') ||
            id.includes('/pages/MessTokens') ||
            id.includes('/pages/OutingRequests') ||
            id.includes('/pages/Complaints') ||
            id.includes('/pages/Leaves') ||
            id.includes('/pages/Notifications')
          ) {
            return 'portal-student';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});

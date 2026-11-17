module.exports = {
  apps: [
    {
      name: 'hms-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5005
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5005
      }
    },
    {
      name: 'hms-frontend-preview',
      cwd: './frontend',
      script: 'npx',
      args: 'vite preview --port 5173 --host',
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};

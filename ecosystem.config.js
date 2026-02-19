module.exports = {
  apps: [
    {
      name: 'form-dashboard-api',
      cwd: './server',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};

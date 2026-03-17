module.exports = {
  apps: [
    {
      name: 'dukaan-pos',
      script: 'npx',
      args: 'serve dist -l 3000 --single',
      env: { NODE_ENV: 'production', PORT: 3000 },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}

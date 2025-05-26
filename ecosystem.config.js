module.exports = {
  apps: [
    /* 仮想ディスプレイ */
    {
      name   : 'xvfb',
      script : '/usr/bin/Xvfb',
      args   : ':99 -screen 0 1280x800x24 -ac',
      autorestart: true
    },
    /* スクレイピング API */
    {
      name   : 'my-scraping-server',
      script : 'server.js',
      env: {
        PORT       : 3000,
        CONCURRENCY: 3,
        DISPLAY    : ':99'
      },
      time: true
    }
  ]
}

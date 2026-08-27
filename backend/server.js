// server.js
//
// Application entry point. Responsible for orchestrating startup in
// this order:
//
//   1. Load environment variables      (src/config/env.js, on require)
//   2. Validate environment variables  (src/config/env.js, on require)
//   3. Connect to MongoDB Atlas        (src/config/db.js)
//   4. Confirm MongoDB connection
//   5. Start the Express HTTP server   (src/app.js)
//
// If the database connection fails, the server is NOT started — we
// never want to pretend everything is fine when it isn't.
const dns = require("dns");
dns.setServers(["1.1.1.1","8.8.8.8"]);
const config = require('./src/config/env');
const connectDatabase = require('./src/config/db');
const app = require('./src/app');

async function startApplication() {
  console.log('▶ Environment loaded');
  console.log(`  NODE_ENV=${config.nodeEnv} PORT=${config.port}`);

  try {
    await connectDatabase();
  } catch (error) {
    console.error('❌ Startup aborted: could not connect to MongoDB Atlas.');
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`✅ Server running on port ${config.port}`);
  });
}

startApplication();

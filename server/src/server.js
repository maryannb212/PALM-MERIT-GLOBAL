import app from './app.js';
import pool from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async (retries = 5) => {
  while (retries) {
    try {
      // Test database connection
      const res = await pool.query('SELECT NOW()');
      console.log(`✅ Database connected successfully at ${res.rows[0].now}`);
      
      const server = app.listen(PORT, () => {
        console.log(`
🚀 Server is running!
🏠 Mode: ${process.env.NODE_ENV || 'development'}
📡 Port: ${PORT}
🔗 URL: http://localhost:${PORT}
        `);
      });

      // Graceful shutdown
      const gracefulShutdown = () => {
        console.log('--- Received kill signal, shutting down gracefully ---');
        server.close(() => {
          console.log('--- Closed out remaining connections ---');
          pool.end().then(() => {
            console.log('--- Database pool has ended ---');
            process.exit(0);
          });
        });

        // If after 10 seconds it hasn't finished, force shutdown
        setTimeout(() => {
          console.error('--- Could not close connections in time, forcefully shutting down ---');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', gracefulShutdown);
      process.on('SIGINT', gracefulShutdown);

      return; // Success
    } catch (error) {
      retries -= 1;
      console.error(`❌ Failed to connect to database. Retries left: ${retries}`);
      console.error(`Error: ${error.message}`);
      if (retries === 0) {
        process.exit(1);
      }
      // wait 5 seconds before retrying
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

startServer();

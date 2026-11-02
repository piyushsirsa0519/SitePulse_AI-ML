/**
 * Site Pulse — Backend HTTP Server Entry Point
 * Production Hardened:
 *   - Graceful shutdown on SIGTERM / SIGINT with 10s forced-exit safety timer
 *   - Catches unhandledRejection and uncaughtException to prevent silent zombie processes
 *   - Closes database connection pool cleanly
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const app = require('./app');
const db = require('./db/client');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`⚡ Site Pulse Backend API listening on port ${PORT} [env: ${process.env.NODE_ENV || 'development'}]`);
});

let isShuttingDown = false;

const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n⚠️ Received ${signal}. Shutting down Site Pulse API server gracefully...`);

    // Force exit if connections take too long to close
    const forceExitTimer = setTimeout(() => {
        console.error('⚠️ Forcefully terminating after 10s shutdown timeout.');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async () => {
        console.log('HTTP server closed.');
        if (db.pool) {
            try {
                await db.pool.end();
                console.log('PostgreSQL connection pool closed.');
            } catch (err) {
                console.error('Error closing database pool:', err.message);
            }
        }
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ [FATAL] Uncaught Exception thrown:', err.message);
    gracefulShutdown('uncaughtException');
});

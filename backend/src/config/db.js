const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database.');
});

// TESTING IF DATABASE CONNECTED WELL AND DISPLAY CURRENT TIME(I commented this out because it was just for testing purposes, but you can uncomment it if you want to test the database connection again)
// if (require.main === module) {
//     pool.query('SELECT NOW()', (err, res) => {
//         if (err) {
//             console.error('Database connection failed:', err.message);
//         } else {
//             console.log('Database connected successfully!');
//             console.log('Database Time:', res.rows[0].now);
//         }
//         pool.end();
//     });
// }

module.exports = {
    query: (text, params) => pool.query(text, params),
};
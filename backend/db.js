const mysql = require('mysql2');

const connection = mysql.createConnection({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 3306,
});

connection.connect((err) => {
  if (err) {
    console.warn('⚠️ Banco não conectado:', err.message);
    return;
  }
  console.log('✅ Conectado ao banco MySQL');
});

function q(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

module.exports = connection;
module.exports.q = q;

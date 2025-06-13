const Database = require('better-sqlite3');

const db = new Database('local.db');

try {
  const userId = 3;
  const deleteStatement = db.prepare('DELETE FROM time_clocks WHERE user_id = ?');
  const result = deleteStatement.run(userId);
  console.log(`Successfully deleted ${result.changes} rows for userId ${userId}`);
} catch (error) {
  console.error('Error clearing database:', error);
} finally {
  db.close();
}
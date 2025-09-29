const pool = require('./db');

function totalToGems(total) {
  return Math.round(total) * 10;
}

function userId() {
  // Da ein User Management und Authentifizierung Out Of Scope sind,
  // ist der Benutzer des Prototyps immer ID 1
  return 1;
}

module.exports = {
  totalToGems,
  userId,
};

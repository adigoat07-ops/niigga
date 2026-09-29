import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

const dataDir = path.resolve('./.postgres-data');
const pg = new EmbeddedPostgres({
  port: 5432,
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
});

try {
  await pg.initialise();
} catch (err) {
  // Already initialised
}

await pg.start();
console.log('PostgreSQL running on port 5432');

try {
  await pg.createDatabase('lab_saathi');
} catch (e) {
  // Already created
}

// Keep alive
setInterval(() => {}, 1000 * 60);

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(
    'DATABASE_URL is missing. Copy backend/.env.example to backend/.env and add the Go-South-Prod Supabase connection string.',
  );
  process.exitCode = 1;
} else {
  let connectionUrl: URL;

  try {
    connectionUrl = new URL(databaseUrl);
    if (
      !['postgresql:', 'postgres:'].includes(connectionUrl.protocol) ||
      !connectionUrl.hostname
    ) {
      throw new Error('invalid PostgreSQL URL');
    }
  } catch {
    console.error(
      'DATABASE_URL is not a valid PostgreSQL connection URL. Copy the Go-South-Prod connection string from Supabase and URL-encode special characters in credentials.',
    );
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    const { db, disconnectDb } = await import('../lib/db.js');

    try {
      await db.$queryRaw`SELECT 1`;
      const expectedTables = await db.$queryRaw<Array<{ tableName: string }>>`
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('org_scopes', 'users', 'shipments', 'packing_units', 'items')
        ORDER BY table_name
      `;

      console.log(
        `Database connection OK; found ${expectedTables.length}/5 expected tables.`,
      );
    } catch (error) {
      console.error(
        'Database connection failed. Check DATABASE_URL and the Supabase project connection settings.',
      );
      console.error(
        error instanceof Error ? error.message : 'Unknown database error',
      );
      process.exitCode = 1;
    } finally {
      await disconnectDb();
    }
  }
}

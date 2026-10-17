import "dotenv/config";

/** Integration tests always run against TEST_DATABASE_URL, never the development database. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set to run integration tests");
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must differ from DATABASE_URL: integration tests erase data",
    );
  }
  return url;
}

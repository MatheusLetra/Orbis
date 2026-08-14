import { seedBrowserFixtures } from "../fixtures/browser-fixtures";

const databaseUrl = process.env.AUDIT_DATABASE_URL;
if (!databaseUrl) throw new Error("AUDIT_DATABASE_URL é obrigatório para o seed browser");
await seedBrowserFixtures(databaseUrl);

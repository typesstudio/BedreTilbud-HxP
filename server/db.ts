import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pooling for Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration for production
  max: 20, // Maximum number of clients in the pool (Neon recommends 10-20 for serverless)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout if connection takes longer than 10 seconds
});

export const db = drizzle({ client: pool, schema });

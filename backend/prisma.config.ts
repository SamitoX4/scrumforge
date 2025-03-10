import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env before Prisma CLI reads environment variables
config();

export default defineConfig({
  schema: 'src/config/db/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

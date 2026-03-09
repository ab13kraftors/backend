import { DataSource } from 'typeorm';
import { seedParticipant } from './participant.seed';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ================== DataSource Configuration ==================
// Configure TypeORM connection for seeding
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  synchronize: true,
});

// ================== run ==================
// Initializes DB, runs seed, then closes connection
async function run() {
  await dataSource.initialize();

  // Seed participant data
  await seedParticipant(dataSource);

  // Close DB connection
  await dataSource.destroy();
}

// Execute seeding script
run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

import { TypeOrmModuleOptions } from '@nestjs/typeorm';

// export const databaseConfig: TypeOrmModuleOptions = {
//   type: 'postgres',
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   username: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   autoLoadEntities: true,
//   synchronize: true,
// };

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'cas_user',
  password: 'cas_password', // Hardcode temporarily to test
  database: 'cas_db',
  autoLoadEntities: true,
  synchronize: true,
};

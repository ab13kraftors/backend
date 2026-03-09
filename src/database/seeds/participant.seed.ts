import { Participant } from 'src/auth/entities/participant.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// ================== seedParticipant ==================
// Seeds a default participant (admin) into the database
export async function seedParticipant(dataSource: DataSource) {
  // Get repository for Participant entity
  const repo = dataSource.getRepository(Participant);

  // Check if admin user already exists
  const existing = await repo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('Participant already seeded - skipping');
    return;
  }

  // Hash default password
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  // Create and save participant record
  await repo.save(
    repo.create({
      participantId: 'BANK_SL_001',
      username: 'admin',
      passwordHash,
      roles: 'admin',
      isActive: true,
    }),
  );

  // Log success message
  console.log('Participant seeded: username=admin, participantId=BANK_SL_001');
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function migrateExistingUsers() {
  try {
    // First, check if there are any users without passwords
    const usersWithoutPassword = await prisma.$queryRaw`
      SELECT id, email FROM User WHERE password IS NULL OR password = ''
    `;

    if (usersWithoutPassword.length === 0) {
      console.log('No users need migration');
      return;
    }

    console.log(`Found ${usersWithoutPassword.length} users to migrate`);

    // Generate a temporary password
    const tempPassword = 'TempPassword123!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update each user with the temporary password
    for (const user of usersWithoutPassword) {
      await prisma.$executeRaw`
        UPDATE User 
        SET password = ${hashedPassword}
        WHERE id = ${user.id}
      `;
      console.log(`Updated user: ${user.email}`);
    }

    console.log('\nMigration complete!');
    console.log('IMPORTANT: Users have been given a temporary password: TempPassword123!');
    console.log('Please inform users to change their password after first login.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateExistingUsers();
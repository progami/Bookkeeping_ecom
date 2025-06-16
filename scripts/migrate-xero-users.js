const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function migrateXeroUsers() {
  try {
    // Find all users with Xero-style emails (UUID@xero.local)
    const xeroUsers = await prisma.user.findMany({
      where: {
        email: {
          endsWith: '@xero.local'
        }
      }
    });

    if (xeroUsers.length === 0) {
      console.log('No Xero users need migration');
      return;
    }

    console.log(`Found ${xeroUsers.length} Xero users to migrate`);

    for (const user of xeroUsers) {
      // Use the existing email from Xero test credentials
      const newEmail = 'ajarrar@trademanenterprise.com';
      const tempPassword = 'gW2r4*8&wFM.#fZ'; // From CLAUDE.md
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Check if a user with this email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: newEmail }
      });

      if (existingUser && existingUser.id !== user.id) {
        console.log(`User with email ${newEmail} already exists, skipping...`);
        continue;
      }

      // Update the user with proper email and password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: newEmail,
          password: hashedPassword,
          name: user.fullName || user.tenantName || 'TRADEMAN ENTERPRISE LTD'
        }
      });

      console.log(`Updated user: ${user.email} -> ${newEmail}`);
      console.log(`User can now login with:`);
      console.log(`Email: ${newEmail}`);
      console.log(`Password: ${tempPassword}`);
    }

    console.log('\nMigration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateXeroUsers();
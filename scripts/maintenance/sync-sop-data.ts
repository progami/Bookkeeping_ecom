import { PrismaClient } from '@prisma/client';
import { sopData } from '../lib/sop-data';

const prisma = new PrismaClient();

async function syncSOPData() {
  console.log('Starting SOP data sync...');
  
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [year, yearData] of Object.entries(sopData)) {
    for (const [chartOfAccount, sops] of Object.entries(yearData)) {
      if (!Array.isArray(sops)) continue;
      
      for (const sop of sops) {
        try {
          const existing = await prisma.standardOperatingProcedure.findUnique({
            where: {
              year_chartOfAccount_serviceType: {
                year,
                chartOfAccount,
                serviceType: sop.serviceType
              }
            }
          });

          if (existing) {
            await prisma.standardOperatingProcedure.update({
              where: {
                year_chartOfAccount_serviceType: {
                  year,
                  chartOfAccount,
                  serviceType: sop.serviceType
                }
              },
              data: {
                pointOfInvoice: 'pointOfInvoice' in sop && typeof sop.pointOfInvoice === 'string' ? sop.pointOfInvoice : null,
                referenceTemplate: sop.referenceTemplate,
                referenceExample: sop.referenceExample,
                descriptionTemplate: sop.descriptionTemplate,
                descriptionExample: sop.descriptionExample,
                note: sop.note || null,
                updatedAt: new Date()
              }
            });
            updated++;
            console.log(`Updated: ${year}/${chartOfAccount}/${sop.serviceType}`);
          } else {
            await prisma.standardOperatingProcedure.create({
              data: {
                year,
                chartOfAccount,
                pointOfInvoice: 'pointOfInvoice' in sop && typeof sop.pointOfInvoice === 'string' ? sop.pointOfInvoice : null,
                serviceType: sop.serviceType,
                referenceTemplate: sop.referenceTemplate,
                referenceExample: sop.referenceExample,
                descriptionTemplate: sop.descriptionTemplate,
                descriptionExample: sop.descriptionExample,
                note: sop.note || null
              }
            });
            created++;
            console.log(`Created: ${year}/${chartOfAccount}/${sop.serviceType}`);
          }
        } catch (error) {
          console.error(`Error syncing SOP for ${year}/${chartOfAccount}/${sop.serviceType}:`, error);
          errors++;
        }
      }
    }
  }

  console.log('\nSync completed:');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${created + updated}`);
}

syncSOPData()
  .catch((e) => {
    console.error('Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
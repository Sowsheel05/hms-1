import fs from 'fs';
import path from 'path';
import { facilityImporterService } from '../services/facility-importer.service';

async function main() {
  console.log('===============================================================');
  console.log('       HMS HOSTEL FACILITY & ROOM INVENTORY EXCEL IMPORTER     ');
  console.log('===============================================================\n');

  // Check argument or search default locations
  const targetFileArg = process.argv[2];
  let targetPath = '';

  const candidates = [
    targetFileArg,
    path.resolve(process.cwd(), 'HMS_Hostel_Facility_Setup_Template.xlsx'),
    path.resolve(process.cwd(), '..', 'HMS_Hostel_Facility_Setup_Template.xlsx'),
    path.resolve(process.cwd(), 'HMS_Master_Configuration_Templates.xlsx'),
    path.resolve(process.cwd(), '..', 'HMS_Master_Configuration_Templates.xlsx'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      targetPath = candidate;
      break;
    }
  }

  if (!targetPath) {
    console.error('❌ Error: No Excel facility setup template found.');
    console.error('Please specify the file path:');
    console.error('  npm run import:facility <path/to/template.xlsx>');
    process.exit(1);
  }

  console.log(`Reading facility template from:\n  📁 ${targetPath}\n`);

  const buffer = fs.readFileSync(targetPath);
  const fileName = path.basename(targetPath);

  const result = await facilityImporterService.importFacilityExcel(buffer, fileName, {
    id: 'system-cli',
    username: 'CLI_IMPORTER',
    role: 'ADMIN',
  });

  console.log('---------------------------------------------------------------');
  console.log(`✅ ${result.message}`);
  console.log('---------------------------------------------------------------');
  console.log('Import Statistics:');
  console.log(`  • Blocks Created:         ${result.counts.blocksCreated}`);
  console.log(`  • Blocks Updated:         ${result.counts.blocksUpdated}`);
  console.log(`  • Rooms Created:          ${result.counts.roomsCreated}`);
  console.log(`  • Rooms Updated:          ${result.counts.roomsUpdated}`);
  console.log(`  • Academic Sessions:      ${result.counts.academicYearsUpserted}`);
  console.log(`  • Mess Meal Slots:        ${result.counts.mealConfigsUpserted}`);
  console.log(`  • Gate / Hardware Readers:${result.counts.devicesUpserted}`);

  if (result.errors.length > 0) {
    console.log('\n⚠️ Warnings / Row Errors:');
    result.errors.forEach((err) => {
      console.log(`  - [${err.sheet} Row ${err.row}] ${err.error}`);
    });
  }

  console.log('===============================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Fatal error importing facility Excel:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

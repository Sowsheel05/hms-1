import * as XLSX from 'xlsx';
import { prisma } from './prisma.service';
import { auditService, sanitizeAuditMetadata } from './audit.service';

export interface ImportFacilityResult {
  success: boolean;
  message: string;
  counts: {
    blocksCreated: number;
    blocksUpdated: number;
    roomsCreated: number;
    roomsUpdated: number;
    academicYearsUpserted: number;
    mealConfigsUpserted: number;
    devicesUpserted: number;
  };
  errors: Array<{ sheet: string; row: number; error: string }>;
}

export class FacilityImporterService {
  /**
   * Imports facility, block, and room configurations from an Excel buffer or file.
   */
  public async importFacilityExcel(
    fileBuffer: Buffer,
    fileName: string,
    actor?: { id: string; username: string; role: string }
  ): Promise<ImportFacilityResult> {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new Error('Invalid Excel file format. Please upload a valid .xlsx or .xls file.');
    }

    const counts = {
      blocksCreated: 0,
      blocksUpdated: 0,
      roomsCreated: 0,
      roomsUpdated: 0,
      academicYearsUpserted: 0,
      mealConfigsUpserted: 0,
      devicesUpserted: 0,
    };
    const errors: Array<{ sheet: string; row: number; error: string }> = [];

    // Helper: find sheet by name substring (case-insensitive)
    const findSheet = (pattern: string) => {
      const match = workbook.SheetNames.find((name) =>
        name.toLowerCase().includes(pattern.toLowerCase())
      );
      return match ? workbook.Sheets[match] : null;
    };

    // -------------------------------------------------------------
    // 1. IMPORT BLOCKS
    // -------------------------------------------------------------
    const blockSheet = findSheet('block');
    const blockCodeToIdMap = new Map<string, string>();

    // Pre-load existing blocks into map
    const existingBlocks = await prisma.block.findMany();
    for (const b of existingBlocks) {
      blockCodeToIdMap.set(b.code.toUpperCase(), b.id);
    }

    if (blockSheet) {
      const rawBlocks: any[] = XLSX.utils.sheet_to_json(blockSheet);
      for (let i = 0; i < rawBlocks.length; i++) {
        const row = rawBlocks[i];
        const rowNum = i + 2;

        const code = String(row['Block_Code'] || row['code'] || '').trim().toUpperCase();
        const name = String(row['Block_Name'] || row['name'] || '').trim();
        const description = String(
          row['Description_or_Location'] || row['Hostel_Type'] || row['description'] || ''
        ).trim();
        const status = String(row['Status'] || 'ACTIVE').trim().toUpperCase();

        if (!code) {
          errors.push({ sheet: 'Blocks', row: rowNum, error: 'Missing Block_Code' });
          continue;
        }
        if (!name) {
          errors.push({ sheet: 'Blocks', row: rowNum, error: 'Missing Block_Name' });
          continue;
        }

        try {
          const existingId = blockCodeToIdMap.get(code);
          if (existingId) {
            const updated = await prisma.block.update({
              where: { id: existingId },
              data: {
                name,
                description: description || undefined,
                status: ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
              },
            });
            blockCodeToIdMap.set(code, updated.id);
            counts.blocksUpdated++;
          } else {
            const created = await prisma.block.create({
              data: {
                code,
                name,
                description: description || null,
                status: ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
              },
            });
            blockCodeToIdMap.set(code, created.id);
            counts.blocksCreated++;
          }
        } catch (err: any) {
          errors.push({ sheet: 'Blocks', row: rowNum, error: err.message || 'Block import error' });
        }
      }
    }

    // -------------------------------------------------------------
    // 2. IMPORT ROOMS & BEDS
    // -------------------------------------------------------------
    const roomSheet = findSheet('room');
    if (roomSheet) {
      const rawRooms: any[] = XLSX.utils.sheet_to_json(roomSheet);
      for (let i = 0; i < rawRooms.length; i++) {
        const row = rawRooms[i];
        const rowNum = i + 2;

        const blockCode = String(row['Block_Code'] || row['blockCode'] || '').trim().toUpperCase();
        const roomNumber = String(row['Room_Number'] || row['roomNumber'] || '').trim();
        const floor = parseInt(row['Floor_Number'] || row['floor'] || '1', 10);
        const roomType = String(
          row['Room_Type'] || row['roomType'] || 'Non-AC Room (2 Sharing)'
        ).trim();
        const capacity = parseInt(row['Bed_Capacity'] || row['capacity'] || '2', 10);
        const statusRaw = String(row['Status'] || 'ACTIVE').trim().toUpperCase();
        const status = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'].includes(statusRaw)
          ? statusRaw
          : 'ACTIVE';

        if (!blockCode || !roomNumber) {
          errors.push({
            sheet: 'Rooms',
            row: rowNum,
            error: 'Missing Block_Code or Room_Number',
          });
          continue;
        }

        const blockId = blockCodeToIdMap.get(blockCode);
        if (!blockId) {
          errors.push({
            sheet: 'Rooms',
            row: rowNum,
            error: `Block_Code "${blockCode}" not found in database or Blocks sheet`,
          });
          continue;
        }

        try {
          const existingRoom = await prisma.room.findUnique({
            where: {
              blockId_roomNumber: {
                blockId,
                roomNumber,
              },
            },
          });

          if (existingRoom) {
            await prisma.room.update({
              where: { id: existingRoom.id },
              data: {
                floor: isNaN(floor) ? 1 : floor,
                roomType,
                capacity: isNaN(capacity) ? 2 : capacity,
                status,
              },
            });
            counts.roomsUpdated++;
          } else {
            await prisma.room.create({
              data: {
                blockId,
                roomNumber,
                floor: isNaN(floor) ? 1 : floor,
                roomType,
                capacity: isNaN(capacity) ? 2 : capacity,
                status,
              },
            });
            counts.roomsCreated++;
          }
        } catch (err: any) {
          errors.push({ sheet: 'Rooms', row: rowNum, error: err.message || 'Room import error' });
        }
      }
    }

    // -------------------------------------------------------------
    // 3. IMPORT ACADEMIC SESSIONS (Optional Sheet)
    // -------------------------------------------------------------
    const academicSheet = findSheet('academic');
    if (academicSheet) {
      const rawSessions: any[] = XLSX.utils.sheet_to_json(academicSheet);
      for (let i = 0; i < rawSessions.length; i++) {
        const row = rawSessions[i];
        const rowNum = i + 2;

        const code = String(row['Academic_Year_Code'] || row['code'] || '').trim();
        const name = String(row['Academic_Year_Name'] || row['name'] || `Academic Year ${code}`).trim();
        const isCurrent =
          String(row['Is_Current_Session'] || 'false').trim().toLowerCase() === 'true';
        const startDateStr = row['Start_Date_YYYY_MM_DD'] || row['startDate'];
        const endDateStr = row['End_Date_YYYY_MM_DD'] || row['endDate'];

        if (!code) continue;

        try {
          const startDate = startDateStr ? new Date(startDateStr) : new Date('2026-07-01');
          const endDate = endDateStr ? new Date(endDateStr) : new Date('2027-05-31');

          await prisma.academicYear.upsert({
            where: { code },
            update: {
              name,
              startDate,
              endDate,
              isCurrent,
            },
            create: {
              code,
              name,
              startDate,
              endDate,
              isCurrent,
              status: 'ACTIVE',
            },
          });
          counts.academicYearsUpserted++;
        } catch (err: any) {
          errors.push({ sheet: 'AcademicSession', row: rowNum, error: err.message });
        }
      }
    }

    // -------------------------------------------------------------
    // 4. IMPORT MESS MEAL SCHEDULE (Optional Sheet)
    // -------------------------------------------------------------
    const mealSheet = findSheet('meal') || findSheet('mess');
    if (mealSheet) {
      const rawMeals: any[] = XLSX.utils.sheet_to_json(mealSheet);
      for (let i = 0; i < rawMeals.length; i++) {
        const row = rawMeals[i];
        const rowNum = i + 2;

        const mealType = String(row['Meal_Type'] || row['mealType'] || '').trim().toUpperCase();
        const name = String(row['Display_Name'] || row['name'] || mealType).trim();
        const startTime = String(row['Start_Time'] || '07:30 AM').trim();
        const endTime = String(row['End_Time'] || '09:30 AM').trim();
        const cutoffHour = parseInt(row['Cutoff_Hour_24hr'] || '7', 10);
        const cutoffMinute = parseInt(row['Cutoff_Minute'] || '0', 10);
        const isActive = String(row['Is_Active'] || 'true').trim().toLowerCase() === 'true';

        if (!['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].includes(mealType)) continue;

        try {
          await prisma.mealConfig.upsert({
            where: { mealType },
            update: {
              name,
              startTime,
              endTime,
              cutoffHour: isNaN(cutoffHour) ? 7 : cutoffHour,
              cutoffMinute: isNaN(cutoffMinute) ? 0 : cutoffMinute,
              isActive,
            },
            create: {
              mealType,
              name,
              startTime,
              endTime,
              startHour: 7,
              startMinute: 30,
              endHour: 9,
              endMinute: 30,
              cutoffHour: isNaN(cutoffHour) ? 7 : cutoffHour,
              cutoffMinute: isNaN(cutoffMinute) ? 0 : cutoffMinute,
              isActive,
            },
          });
          counts.mealConfigsUpserted++;
        } catch (err: any) {
          errors.push({ sheet: 'MessSchedule', row: rowNum, error: err.message });
        }
      }
    }

    // -------------------------------------------------------------
    // 5. IMPORT GATES & DEVICES (Optional Sheet)
    // -------------------------------------------------------------
    const gateSheet = findSheet('gate') || findSheet('device');
    if (gateSheet) {
      const rawGates: any[] = XLSX.utils.sheet_to_json(gateSheet);
      for (let i = 0; i < rawGates.length; i++) {
        const row = rawGates[i];
        const rowNum = i + 2;

        const deviceIdentifier = String(
          row['Gate_or_Reader_ID'] || row['Device_Identifier'] || row['id'] || ''
        ).trim().toUpperCase();
        const name = String(row['Location_or_Gate_Name'] || row['Device_Name'] || deviceIdentifier).trim();
        const deviceType = String(row['Device_Type'] || 'TURNSTILE').trim().toUpperCase();
        const location = String(row['Location_or_Gate_Name'] || row['Location'] || 'Campus Gate').trim();

        if (!deviceIdentifier) continue;

        try {
          await prisma.biometricDevice.upsert({
            where: { deviceIdentifier },
            update: {
              name,
              deviceType,
              location,
              status: 'ONLINE',
              isEnabled: true,
            },
            create: {
              deviceIdentifier,
              name,
              deviceType,
              location,
              status: 'ONLINE',
              isEnabled: true,
            },
          });
          counts.devicesUpserted++;
        } catch (err: any) {
          errors.push({ sheet: 'Gates', row: rowNum, error: err.message });
        }
      }
    }

    // Record audit log
    if (actor) {
      try {
        let validActorId = actor.id;
        const userExists = await prisma.student.findUnique({ where: { id: actor.id } });
        if (!userExists) {
          const adminUser = await prisma.student.findFirst({ where: { role: 'ADMIN' } });
          if (adminUser) validActorId = adminUser.id;
        }

        if (validActorId && validActorId !== 'system-cli') {
          await auditService.recordLog({
            actorId: validActorId,
            action: 'IMPORT',
            actorRole: actor.role,
            entity: 'FacilityInventory',
            description: `Imported facility Excel file "${fileName}": ${counts.blocksCreated} blocks created, ${counts.blocksUpdated} blocks updated, ${counts.roomsCreated} rooms created, ${counts.roomsUpdated} rooms updated.`,
            metadata: sanitizeAuditMetadata({
              fileName,
              counts,
              errorCount: errors.length,
            }),
          });
        }
      } catch (auditErr) {
        console.warn('Audit log skipped for facility import:', auditErr);
      }
    }

    const message = `Facility import complete: ${counts.blocksCreated + counts.blocksUpdated} blocks and ${
      counts.roomsCreated + counts.roomsUpdated
    } rooms processed. ${errors.length > 0 ? `(${errors.length} row warnings)` : ''}`;

    return {
      success: true,
      message,
      counts,
      errors,
    };
  }
}

export const facilityImporterService = new FacilityImporterService();

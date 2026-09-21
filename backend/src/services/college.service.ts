import { prisma } from './prisma.service';

export interface CreateCollegeDTO {
  code: string;
  name: string;
  location?: string;
  contactEmail?: string;
  isPrimary?: boolean;
  totalBlocks?: number;
  totalStudents?: number;
}

export interface UpdateCollegeDTO {
  name?: string;
  location?: string;
  contactEmail?: string;
  status?: string;
  isPrimary?: boolean;
  totalBlocks?: number;
  totalStudents?: number;
}

export class CollegeService {
  public async getColleges() {
    const colleges = await prisma.college.findMany({
      orderBy: [
        { isPrimary: 'desc' },
        { name: 'asc' },
      ],
    });
    return colleges;
  }

  public async getCollegeById(id: string) {
    const college = await prisma.college.findUnique({
      where: { id },
    });
    if (!college) {
      throw new Error(`College with ID '${id}' not found.`);
    }
    return college;
  }

  public async createCollege(data: CreateCollegeDTO) {
    const existing = await prisma.college.findUnique({
      where: { code: data.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new Error(`College with code '${data.code}' already exists.`);
    }

    if (data.isPrimary) {
      await prisma.college.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return await prisma.college.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        location: data.location?.trim() || 'Main Campus',
        contactEmail: data.contactEmail?.trim() || 'info@campus.edu',
        isPrimary: !!data.isPrimary,
        totalBlocks: data.totalBlocks || 4,
        totalStudents: data.totalStudents || 1000,
        status: 'ACTIVE',
      },
    });
  }

  public async updateCollege(id: string, data: UpdateCollegeDTO) {
    await this.getCollegeById(id);

    if (data.isPrimary) {
      await prisma.college.updateMany({
        where: { isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }

    return await prisma.college.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.location && { location: data.location.trim() }),
        ...(data.contactEmail && { contactEmail: data.contactEmail.trim() }),
        ...(data.status && { status: data.status.trim().toUpperCase() }),
        ...(typeof data.isPrimary === 'boolean' && { isPrimary: data.isPrimary }),
        ...(typeof data.totalBlocks === 'number' && { totalBlocks: data.totalBlocks }),
        ...(typeof data.totalStudents === 'number' && { totalStudents: data.totalStudents }),
      },
    });
  }
}

export const collegeService = new CollegeService();

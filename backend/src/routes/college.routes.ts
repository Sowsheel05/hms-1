import { Router, Response } from 'express';
import { authenticateManagement, AuthenticatedManagementRequest } from '../middleware/management.middleware';
import { collegeService } from '../services/college.service';

const router = Router();

// Require management authentication
router.use(authenticateManagement);

/**
 * GET /api/management/colleges
 * Returns list of all registered colleges
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const colleges = await collegeService.getColleges();
    res.json({
      success: true,
      colleges,
      count: colleges.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch colleges list.',
    });
  }
});

/**
 * GET /api/management/colleges/:id
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const college = await collegeService.getCollegeById(req.params.id);
    res.json({
      success: true,
      college,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/management/colleges
 * Create a new college campus
 */
router.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { code, name, location, contactEmail, isPrimary, totalBlocks, totalStudents } = req.body;
    if (!code || !name) {
      res.status(400).json({
        success: false,
        message: 'College code and name are required.',
      });
      return;
    }

    const college = await collegeService.createCollege({
      code,
      name,
      location,
      contactEmail,
      isPrimary,
      totalBlocks,
      totalStudents,
    });

    res.status(201).json({
      success: true,
      message: 'College registered successfully.',
      college,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create college.',
    });
  }
});

/**
 * PUT /api/management/colleges/:id
 * Update college details or status
 */
router.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const college = await collegeService.updateCollege(req.params.id, req.body);
    res.json({
      success: true,
      message: 'College updated successfully.',
      college,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update college.',
    });
  }
});

export default router;

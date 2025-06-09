const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/projects - Get all projects (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT p.*, u.username as created_by_username
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM projects p';
    let queryParams = [];
    let countParams = [];
    let whereConditions = [];

    // Add search filter
    if (search) {
      whereConditions.push(`(p.name ILIKE $${queryParams.length + 1} OR p.description ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Add status filter
    if (status && ['started', 'active', 'done'].includes(status)) {
      whereConditions.push(`p.status = $${queryParams.length + 1}`);
      queryParams.push(status);
      countParams.push(status);
    }

    // Apply WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [projectsResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalProjects = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalProjects / limit);

    res.json({
      projects: projectsResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalProjects,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/projects - Create new project (admin only)
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['started', 'active', 'done'])
    .withMessage('Status must be one of: started, active, done')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description = '', status = 'started' } = req.body;

    // Check if project name already exists
    const existingProject = await req.app.locals.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [name]
    );

    if (existingProject.rows.length > 0) {
      return res.status(409).json({ message: 'Project name already exists' });
    }

    // Create project
    const result = await req.app.locals.db.query(
      'INSERT INTO projects (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, status, req.user.userId]
    );

    // Get the created project with creator info
    const projectWithCreator = await req.app.locals.db.query(
      'SELECT p.*, u.username as created_by_username FROM projects p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = $1',
      [result.rows[0].id]
    );

    res.status(201).json({
      message: 'Project created successfully',
      project: projectWithCreator.rows[0]
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/projects/:id - Get specific project (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const result = await req.app.locals.db.query(
      'SELECT p.*, u.username as created_by_username FROM projects p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ project: result.rows[0] });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/projects/:id - Update project (admin only)
router.put('/:id', requireAdmin, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['started', 'active', 'done'])
    .withMessage('Status must be one of: started, active, done')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const updates = {};
    const allowedFields = ['name', 'description', 'status'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Check if name already exists (if being updated)
    if (updates.name) {
      const existingProject = await req.app.locals.db.query(
        'SELECT id FROM projects WHERE name = $1 AND id != $2',
        [updates.name, projectId]
      );

      if (existingProject.rows.length > 0) {
        return res.status(409).json({ message: 'Project name already exists' });
      }
    }

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(projectId);

    const query = `
      UPDATE projects 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get the updated project with creator info
    const projectWithCreator = await req.app.locals.db.query(
      'SELECT p.*, u.username as created_by_username FROM projects p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = $1',
      [projectId]
    );

    res.json({
      message: 'Project updated successfully',
      project: projectWithCreator.rows[0]
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/projects/:id - Delete project (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM projects WHERE id = $1 RETURNING id, name',
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project deleted successfully',
      deletedProject: result.rows[0]
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
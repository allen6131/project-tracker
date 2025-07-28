const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer storage configuration for project files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
      SELECT p.*, 
             u.username as created_by_username, 
             c.name as customer_name,
             mt.username as main_technician_username,
             mt.email as main_technician_email
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users mt ON p.main_technician_id = mt.id
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
router.post('/', requireAdmin, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  body('master_permit_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Master permit number must not exceed 100 characters'),
  body('electrical_sub_permit')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Electrical sub permit must not exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['bidding', 'started', 'active', 'done'])
    .withMessage('Status must be one of: bidding, started, active, done'),
  body('customer_id')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true; // Allow empty values
      if (!Number.isInteger(Number(value))) throw new Error('Customer ID must be a valid integer or empty');
      return true;
    }),
  body('main_technician_id')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true; // Allow empty values
      if (!Number.isInteger(Number(value))) throw new Error('Main technician ID must be a valid integer or empty');
      return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description = '', address = '', master_permit_number = '', electrical_sub_permit = '', status = 'bidding', customer_id, main_technician_id } = req.body;

    // Check if project name already exists
    const existingProject = await req.app.locals.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [name]
    );

    if (existingProject.rows.length > 0) {
      return res.status(409).json({ message: 'Project name already exists' });
    }

    // Validate customer exists if provided
    if (customer_id) {
      const customerCheck = await req.app.locals.db.query(
        'SELECT id FROM customers WHERE id = $1',
        [customer_id]
      );
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid customer ID' });
      }
    }

    // Validate main technician exists if provided
    if (main_technician_id) {
      const technicianCheck = await req.app.locals.db.query(
        'SELECT id FROM users WHERE id = $1 AND is_active = true',
        [main_technician_id]
      );
      if (technicianCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid main technician ID or user is not active' });
      }
    }

    // Create project
    const result = await req.app.locals.db.query(
      'INSERT INTO projects (name, description, address, master_permit_number, electrical_sub_permit, status, customer_id, main_technician_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, description, address || null, master_permit_number || null, electrical_sub_permit || null, status, customer_id || null, main_technician_id || null, req.user.userId]
    );

    const projectId = result.rows[0].id;

    // Create default folders for the new project
    const defaultFolders = ['Bidding', 'Plans and Drawings', 'Plan Review', 'Field Markups'];
    for (const folderName of defaultFolders) {
      await req.app.locals.db.query(
        'INSERT INTO project_folders (project_id, name, is_default, created_by) VALUES ($1, $2, true, $3)',
        [projectId, folderName, req.user.userId]
      );
    }

    // Get the created project with creator, customer, and main technician info
    const projectWithInfo = await req.app.locals.db.query(
      `SELECT p.*, 
              u.username as created_by_username, 
              c.name as customer_name,
              mt.username as main_technician_username,
              mt.email as main_technician_email
       FROM projects p 
       LEFT JOIN users u ON p.created_by = u.id 
       LEFT JOIN customers c ON p.customer_id = c.id 
       LEFT JOIN users mt ON p.main_technician_id = mt.id
       WHERE p.id = $1`,
      [projectId]
    );

    res.status(201).json({
      message: 'Project created successfully',
      project: projectWithInfo.rows[0]
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
      `SELECT p.*, 
              u.username as created_by_username, 
              c.name as customer_name,
              mt.username as main_technician_username,
              mt.email as main_technician_email
       FROM projects p 
       LEFT JOIN users u ON p.created_by = u.id 
       LEFT JOIN customers c ON p.customer_id = c.id 
       LEFT JOIN users mt ON p.main_technician_id = mt.id
       WHERE p.id = $1`,
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

// GET /api/projects/:id/files - Get all files for a project
router.get('/:id/files', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }
    
    // Get files with folder information
    const result = await req.app.locals.db.query(
      `SELECT pf.*, pfolder.name as folder_name 
       FROM project_files pf 
       LEFT JOIN project_folders pfolder ON pf.folder_id = pfolder.id 
       WHERE pf.project_id = $1 
       ORDER BY pf.created_at DESC`,
      [projectId]
    );

    res.json({ files: result.rows });

  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/projects/:id/upload - Upload a file for a project
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { is_public = true, folder_id } = req.body;
    const { originalname, filename, path: filePath, mimetype, size } = req.file;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    let finalFolderId = null;
    
    // If folder_id is provided, validate it belongs to the project
    if (folder_id) {
      const folderIdInt = parseInt(folder_id);
      if (!isNaN(folderIdInt)) {
        const folderResult = await req.app.locals.db.query(
          'SELECT id FROM project_folders WHERE id = $1 AND project_id = $2',
          [folderIdInt, projectId]
        );
        if (folderResult.rows.length > 0) {
          finalFolderId = folderIdInt;
        }
      }
    }

    const result = await req.app.locals.db.query(
      `INSERT INTO project_files 
        (project_id, original_name, stored_name, file_path, file_type, file_size, is_public, uploaded_by, folder_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [projectId, originalname, filename, filePath, mimetype, size, is_public, req.user.userId, finalFolderId]
    );

    res.status(201).json({ message: 'File uploaded successfully', file: result.rows[0] });

  } catch (error) {
    console.error('File upload error:', error);
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
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must not exceed 500 characters'),
  body('master_permit_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Master permit number must not exceed 100 characters'),
  body('electrical_sub_permit')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Electrical sub permit must not exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['bidding', 'started', 'active', 'done'])
    .withMessage('Status must be one of: bidding, started, active, done'),
  body('customer_id')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true; // Allow null/empty for removing customer
      if (!Number.isInteger(Number(value))) throw new Error('Customer ID must be a valid integer or null');
      return true;
    }),
  body('main_technician_id')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true; // Allow null/empty for removing main technician
      if (!Number.isInteger(Number(value))) throw new Error('Main technician ID must be a valid integer or null');
      return true;
    })
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
    const allowedFields = ['name', 'description', 'address', 'master_permit_number', 'electrical_sub_permit', 'status', 'customer_id', 'main_technician_id'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
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

    // Validate customer exists if provided
    if (updates.customer_id) {
      const customerCheck = await req.app.locals.db.query(
        'SELECT id FROM customers WHERE id = $1',
        [updates.customer_id]
      );
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid customer ID' });
      }
    }

    // Validate main technician exists if provided
    if (updates.main_technician_id) {
      const technicianCheck = await req.app.locals.db.query(
        'SELECT id FROM users WHERE id = $1 AND is_active = true',
        [updates.main_technician_id]
      );
      if (technicianCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid main technician ID or user is not active' });
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

    // Get the updated project with creator, customer, and main technician info
    const projectWithInfo = await req.app.locals.db.query(
      `SELECT p.*, 
              u.username as created_by_username, 
              c.name as customer_name,
              mt.username as main_technician_username,
              mt.email as main_technician_email
       FROM projects p 
       LEFT JOIN users u ON p.created_by = u.id 
       LEFT JOIN customers c ON p.customer_id = c.id 
       LEFT JOIN users mt ON p.main_technician_id = mt.id
       WHERE p.id = $1`,
      [projectId]
    );

    res.json({
      message: 'Project updated successfully',
      project: projectWithInfo.rows[0]
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

// GET /api/projects/:id/folders - Get all folders for a project
router.get('/:id/folders', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const result = await req.app.locals.db.query(
      'SELECT * FROM project_folders WHERE project_id = $1 ORDER BY is_default DESC, name ASC',
      [projectId]
    );

    res.json({ folders: result.rows });

  } catch (error) {
    console.error('Get project folders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/projects/:id/folders - Create a new folder (admin only)
router.post('/:id/folders', requireAdmin, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Folder name must be between 1 and 255 characters')
    .custom((value, { req }) => {
      // Check for special characters that might cause issues
      if (value.includes('/') || value.includes('\\')) {
        throw new Error('Folder name cannot contain slashes');
      }
      return true;
    })
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
    const { name } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    // Check if folder name already exists for this project
    const existingFolder = await req.app.locals.db.query(
      'SELECT id FROM project_folders WHERE project_id = $1 AND name = $2',
      [projectId, name]
    );

    if (existingFolder.rows.length > 0) {
      return res.status(409).json({ message: 'Folder name already exists for this project' });
    }

    // Create folder
    const result = await req.app.locals.db.query(
      'INSERT INTO project_folders (project_id, name, is_default, created_by) VALUES ($1, $2, false, $3) RETURNING *',
      [projectId, name, req.user.userId]
    );

    res.status(201).json({
      message: 'Folder created successfully',
      folder: result.rows[0]
    });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/projects/:projectId/folders/:folderId - Delete a folder (admin only)
router.delete('/:projectId/folders/:folderId', requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const folderId = parseInt(req.params.folderId);

    if (isNaN(projectId) || isNaN(folderId)) {
      return res.status(400).json({ message: 'Invalid project ID or folder ID' });
    }

    // Check if folder exists and belongs to the project
    const folderResult = await req.app.locals.db.query(
      'SELECT * FROM project_folders WHERE id = $1 AND project_id = $2',
      [folderId, projectId]
    );

    if (folderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const folder = folderResult.rows[0];

    // Prevent deletion of default folders
    if (folder.is_default) {
      return res.status(400).json({ message: 'Cannot delete default folders' });
    }

    // Check if folder has files
    const filesResult = await req.app.locals.db.query(
      'SELECT COUNT(*) FROM project_files WHERE folder_id = $1',
      [folderId]
    );

    if (parseInt(filesResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete folder that contains files. Please move or delete all files first.' 
      });
    }

    // Delete folder
    await req.app.locals.db.query(
      'DELETE FROM project_folders WHERE id = $1',
      [folderId]
    );

    res.json({ message: 'Folder deleted successfully' });

  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/projects/customer/:customerId - Get projects by customer ID
router.get('/customer/:customerId', requireAdmin, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT p.*, 
              u.username as created_by_username, 
              c.name as customer_name,
              mt.username as main_technician_username,
              mt.email as main_technician_email
       FROM projects p 
       LEFT JOIN users u ON p.created_by = u.id 
       LEFT JOIN customers c ON p.customer_id = c.id 
       LEFT JOIN users mt ON p.main_technician_id = mt.id
       WHERE p.customer_id = $1
       ORDER BY p.created_at DESC`,
      [customerId]
    );

    res.json({ projects: result.rows });

  } catch (error) {
    console.error('Get projects by customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
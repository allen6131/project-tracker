const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');
const EmailService = require('../services/emailService');
const PDFService = require('../services/pdfService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer storage configuration for estimate documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/estimates/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'estimate-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word documents, text files, and images are allowed for estimates'));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/estimates - Get all estimates
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const project_id = req.query.project_id || '';

    let query = `
      SELECT e.*, u.username as created_by_username, p.name as project_name, 
             c.name as customer_name
      FROM estimates e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN projects p ON e.project_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM estimates e LEFT JOIN projects p ON e.project_id = p.id';
    let queryParams = [];
    let countParams = [];
    let whereConditions = [];

    // Add search filter
    if (search) {
      whereConditions.push(`(e.title ILIKE $${queryParams.length + 1} OR e.description ILIKE $${queryParams.length + 1} OR p.name ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Add status filter
    if (status && ['draft', 'sent', 'approved', 'rejected'].includes(status)) {
      whereConditions.push(`e.status = $${queryParams.length + 1}`);
      queryParams.push(status);
      countParams.push(status);
    }

    // Add project filter
    if (project_id) {
      whereConditions.push(`e.project_id = $${queryParams.length + 1}`);
      queryParams.push(project_id);
      countParams.push(project_id);
    }

    // Apply WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [estimatesResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalEstimates = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalEstimates / limit);

    // Convert decimal values to numbers for each estimate
    const estimates = estimatesResult.rows.map(estimate => ({
      ...estimate,
      total_amount: parseFloat(estimate.total_amount) || 0
    }));

    res.json({
      estimates,
      pagination: {
        currentPage: page,
        totalPages,
        totalEstimates,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates - Create new estimate with document upload
router.post('/', upload.single('document'), [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('project_id')
    .isInt()
    .withMessage('Project ID is required and must be a valid integer'),
  body('total_amount')
    .isFloat({ min: 0 })
    .withMessage('Total amount is required and must be 0 or greater'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Require document upload
    if (!req.file) {
      return res.status(400).json({
        message: 'Document upload is required for estimates'
      });
    }

    const { 
      title, 
      description = '', 
      project_id,
      total_amount,
      notes = ''
    } = req.body;

    // Validate project exists
    const projectCheck = await req.app.locals.db.query(
      'SELECT id, name FROM projects WHERE id = $1',
      [project_id]
    );
    
    if (projectCheck.rows.length === 0) {
      // Clean up uploaded file
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    // Create estimate
    const estimateResult = await req.app.locals.db.query(
      `INSERT INTO estimates (
        title, description, project_id, total_amount, document_path, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, project_id, total_amount, req.file.path, notes, req.user.userId]
    );

    const estimate = {
      ...estimateResult.rows[0],
      total_amount: parseFloat(estimateResult.rows[0].total_amount) || 0,
      project_name: projectCheck.rows[0].name
    };

    // Generate PDF after creating estimate
    try {
      console.log(`Generating PDF for new estimate ${estimate.id}...`);
      const pdfBuffer = await PDFService.generateEstimatePDF(estimate, req.app.locals.db);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Create estimates directory if it doesn't exist
      const estimatesDir = path.join('uploads/estimates/');
      if (!fs.existsSync(estimatesDir)) {
        fs.mkdirSync(estimatesDir, { recursive: true });
      }
      
      // Save PDF to estimates directory
      const pdfPath = path.join(estimatesDir, `estimate-${estimate.id}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // Verify the file was written correctly
      const stats = fs.statSync(pdfPath);
      if (stats.size === 0) {
        throw new Error('Written PDF file is empty');
      }
      
      console.log(`PDF generated successfully for new estimate ${estimate.id}, size: ${stats.size} bytes`);
      
      // Update estimate with PDF path
      await req.app.locals.db.query(
        'UPDATE estimates SET pdf_path = $1 WHERE id = $2',
        [pdfPath, estimate.id]
      );
      
      estimate.pdf_path = pdfPath;
    } catch (pdfError) {
      console.error('Failed to generate PDF for estimate:', pdfError);
      // Continue without PDF - don't fail the entire operation
      estimate.pdf_path = null;
    }

    res.status(201).json({
      message: 'Estimate created successfully',
      estimate
    });

  } catch (error) {
    console.error('Create estimate error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/estimates/:id - Get specific estimate
router.get('/:id', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT e.*, u.username as created_by_username, p.name as project_name,
              c.name as customer_name
       FROM estimates e
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE e.id = $1`,
      [estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };

    res.json({ estimate });

  } catch (error) {
    console.error('Get estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/estimates/:id - Update estimate
router.put('/:id', upload.single('document'), [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('total_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total amount must be 0 or greater'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'rejected'])
    .withMessage('Status must be one of: draft, sent, approved, rejected'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get current estimate
    const currentEstimate = await req.app.locals.db.query(
      'SELECT * FROM estimates WHERE id = $1',
      [estimateId]
    );

    if (currentEstimate.rows.length === 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const updates = {};
    const allowedFields = ['title', 'description', 'total_amount', 'status', 'notes'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    // Handle document update
    if (req.file) {
      // Delete old document if it exists
      const oldDocumentPath = currentEstimate.rows[0].document_path;
      if (oldDocumentPath && fs.existsSync(oldDocumentPath)) {
        fs.unlink(oldDocumentPath, () => {});
      }
      updates.document_path = req.file.path;
    }

    if (Object.keys(updates).length === 0) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(estimateId);

    const query = `
      UPDATE estimates 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };

    res.json({
      message: 'Estimate updated successfully',
      estimate
    });

  } catch (error) {
    console.error('Update estimate error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/estimates/:id - Delete estimate
router.delete('/:id', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get estimate to delete document file
    const estimateResult = await req.app.locals.db.query(
      'SELECT * FROM estimates WHERE id = $1',
      [estimateId]
    );

    if (estimateResult.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = estimateResult.rows[0];

    // Delete from database
    const result = await req.app.locals.db.query(
      'DELETE FROM estimates WHERE id = $1 RETURNING id, title',
      [estimateId]
    );

    // Delete document file if it exists
    if (estimate.document_path && fs.existsSync(estimate.document_path)) {
      fs.unlink(estimate.document_path, (err) => {
        if (err) {
          console.error('Error deleting estimate document:', err);
        }
      });
    }

    res.json({
      message: 'Estimate deleted successfully',
      deletedEstimate: result.rows[0]
    });

  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/estimates/:id/download - Download estimate document or generate PDF
router.get('/:id/download', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    console.log('Download request for estimate ID:', estimateId);
    
    if (isNaN(estimateId)) {
      console.log('Invalid estimate ID provided:', req.params.id);
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get full estimate data for potential PDF generation
    const result = await req.app.locals.db.query(
      `SELECT e.*, p.name as project_name, c.name as customer_name, u.username as created_by_username
       FROM estimates e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [estimateId]
    );

    console.log('Database query result:', result.rows.length > 0 ? 'Found estimate' : 'No estimate found');

    if (result.rows.length === 0) {
      console.log('Estimate not found for ID:', estimateId);
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };
    
    console.log('Estimate document_path:', estimate.document_path);

    // Try to serve the original document if it exists and is valid
    if (estimate.document_path && fs.existsSync(estimate.document_path)) {
      try {
        const stats = fs.statSync(estimate.document_path);
        if (stats.size > 0) {
          console.log('Found existing document, serving original file');
          const originalName = path.basename(estimate.document_path);
          const downloadName = `${estimate.title.replace(/[^a-zA-Z0-9]/g, '_')}_estimate${path.extname(originalName)}`;
          
          return res.download(estimate.document_path, downloadName, (err) => {
            if (err) {
              console.error('Download error:', err);
              if (!res.headersSent) {
                res.status(500).json({ message: 'Failed to download file' });
              }
            } else {
              console.log('Original document download completed successfully');
            }
          });
        } else {
          console.log('Document exists but is empty, will generate PDF instead');
        }
      } catch (fileError) {
        console.log('Error reading existing document:', fileError.message, '- will generate PDF instead');
      }
    } else {
      console.log('No document found, will generate PDF instead');
    }

    // Generate PDF if no valid document exists
    console.log('Generating PDF for estimate download...');
    try {
      const pdfBuffer = await PDFService.generateEstimatePDF(estimate, req.app.locals.db);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      
      // Create estimates directory if it doesn't exist
      const estimatesDir = path.join('uploads/estimates/');
      if (!fs.existsSync(estimatesDir)) {
        fs.mkdirSync(estimatesDir, { recursive: true });
      }
      
      // Save the generated PDF for future use
      const pdfPath = path.join(estimatesDir, `estimate-${estimate.id}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // Update estimate with PDF path if it doesn't have a document_path
      if (!estimate.document_path) {
        await req.app.locals.db.query(
          'UPDATE estimates SET pdf_path = $1 WHERE id = $2',
          [pdfPath, estimate.id]
        );
      }
      
      const downloadName = `${estimate.title.replace(/[^a-zA-Z0-9]/g, '_')}_estimate.pdf`;
      
      // Send the PDF buffer directly
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      
      console.log('PDF download completed successfully');
      
    } catch (pdfError) {
      console.error('Failed to generate PDF for download:', pdfError);
      return res.status(500).json({ 
        message: 'Failed to generate PDF for download', 
        error: pdfError.message 
      });
    }

  } catch (error) {
    console.error('Download estimate error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// GET /api/estimates/:id/pdf - Download estimate PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT e.*, p.name as project_name, c.name as customer_name, u.username as created_by_username
       FROM estimates e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };

    console.log(`Attempting to download PDF for estimate ${estimateId}`);

    // Check if PDF exists and is valid
    if (estimate.pdf_path && fs.existsSync(estimate.pdf_path)) {
      try {
        const stats = fs.statSync(estimate.pdf_path);
        if (stats.size > 0) {
          console.log(`Found existing PDF for estimate ${estimateId} at ${estimate.pdf_path}`);
          const downloadName = `estimate-${estimate.id}.pdf`;
          return res.download(estimate.pdf_path, downloadName);
        } else {
          console.log(`PDF file exists but is empty for estimate ${estimateId}, regenerating...`);
        }
      } catch (fileError) {
        console.log(`Error reading existing PDF for estimate ${estimateId}:`, fileError.message);
      }
    } else {
      console.log(`No PDF found for estimate ${estimateId}, generating new one...`);
    }

    // Generate PDF if it doesn't exist or is invalid
    try {
      console.log(`Generating PDF for estimate ${estimateId}...`);
      const pdfBuffer = await PDFService.generateEstimatePDF(estimate, req.app.locals.db);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Create estimates directory if it doesn't exist
      const estimatesDir = path.join('uploads/estimates/');
      if (!fs.existsSync(estimatesDir)) {
        fs.mkdirSync(estimatesDir, { recursive: true });
      }
      
      const pdfPath = path.join(estimatesDir, `estimate-${estimate.id}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // Verify the file was written correctly
      const stats = fs.statSync(pdfPath);
      if (stats.size === 0) {
        throw new Error('Written PDF file is empty');
      }
      
      console.log(`PDF generated successfully for estimate ${estimateId}, size: ${stats.size} bytes`);
      
      // Update estimate with PDF path
      await req.app.locals.db.query(
        'UPDATE estimates SET pdf_path = $1 WHERE id = $2',
        [pdfPath, estimate.id]
      );
      
      const downloadName = `estimate-${estimate.id}.pdf`;
      return res.download(pdfPath, downloadName);
    } catch (pdfError) {
      console.error('Failed to generate PDF for estimate:', pdfError);
      return res.status(500).json({ 
        message: 'Failed to generate PDF', 
        error: pdfError.message,
        estimate_id: estimate.id 
      });
    }

  } catch (error) {
    console.error('Download estimate PDF error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/estimates/:id/view - View estimate PDF in browser
router.get('/:id/view', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT e.*, p.name as project_name, c.name as customer_name, u.username as created_by_username
       FROM estimates e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };

    console.log(`Attempting to view PDF for estimate ${estimateId}`);

    // Check if PDF exists and is valid
    if (estimate.pdf_path && fs.existsSync(estimate.pdf_path)) {
      try {
        const stats = fs.statSync(estimate.pdf_path);
        if (stats.size > 0) {
          console.log(`Found existing PDF for estimate ${estimateId} at ${estimate.pdf_path}`);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="estimate-' + estimate.id + '.pdf"');
          return fs.createReadStream(estimate.pdf_path).pipe(res);
        } else {
          console.log(`PDF file exists but is empty for estimate ${estimateId}, regenerating...`);
        }
      } catch (fileError) {
        console.log(`Error reading existing PDF for estimate ${estimateId}:`, fileError.message);
      }
    } else {
      console.log(`No PDF found for estimate ${estimateId}, generating new one...`);
    }

    // Generate PDF if it doesn't exist or is invalid
    try {
      console.log(`Generating PDF for estimate ${estimateId}...`);
      const pdfBuffer = await PDFService.generateEstimatePDF(estimate, req.app.locals.db);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Create estimates directory if it doesn't exist
      const estimatesDir = path.join('uploads/estimates/');
      if (!fs.existsSync(estimatesDir)) {
        fs.mkdirSync(estimatesDir, { recursive: true });
      }
      
      const pdfPath = path.join(estimatesDir, `estimate-${estimate.id}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // Verify the file was written correctly
      const stats = fs.statSync(pdfPath);
      if (stats.size === 0) {
        throw new Error('Written PDF file is empty');
      }
      
      console.log(`PDF generated successfully for estimate ${estimateId}, size: ${stats.size} bytes`);
      
      // Update estimate with PDF path
      await req.app.locals.db.query(
        'UPDATE estimates SET pdf_path = $1 WHERE id = $2',
        [pdfPath, estimate.id]
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="estimate-' + estimate.id + '.pdf"');
      return res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('Failed to generate PDF for estimate:', pdfError);
      
      // Return a basic HTML response with error details for debugging
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>PDF Generation Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background-color: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
            .details { background-color: #f9f9f9; padding: 10px; margin: 10px 0; border-radius: 3px; }
            .estimate-info { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>PDF Generation Failed</h2>
            <p>Unable to generate PDF for estimate #${estimate.id}.</p>
            <div class="details">
              <strong>Error:</strong> ${pdfError.message}
            </div>
            <div class="estimate-info">
              <h3>Estimate Information:</h3>
              <p><strong>ID:</strong> ${estimate.id}</p>
              <p><strong>Title:</strong> ${estimate.title}</p>
              <p><strong>Project:</strong> ${estimate.project_name || 'N/A'}</p>
              <p><strong>Customer:</strong> ${estimate.customer_name || 'N/A'}</p>
              <p><strong>Amount:</strong> $${estimate.total_amount.toFixed(2)}</p>
              <p><strong>Created:</strong> ${new Date(estimate.created_at).toLocaleDateString()}</p>
            </div>
            <p>Please contact support if this issue persists.</p>
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(errorHtml);
    }

  } catch (error) {
    console.error('View estimate PDF error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates/:id/regenerate-pdf - Regenerate estimate PDF
router.post('/:id/regenerate-pdf', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT e.*, p.name as project_name, c.name as customer_name, u.username as created_by_username
       FROM estimates e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = {
      ...result.rows[0],
      total_amount: parseFloat(result.rows[0].total_amount) || 0
    };

    try {
      console.log(`Regenerating PDF for estimate ${estimateId}...`);
      
      // Delete existing PDF if it exists
      if (estimate.pdf_path && fs.existsSync(estimate.pdf_path)) {
        try {
          fs.unlinkSync(estimate.pdf_path);
          console.log(`Deleted existing PDF for estimate ${estimateId}`);
        } catch (deleteError) {
          console.warn(`Failed to delete existing PDF for estimate ${estimateId}:`, deleteError.message);
        }
      }
      
      const pdfBuffer = await PDFService.generateEstimatePDF(estimate, req.app.locals.db);
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Create estimates directory if it doesn't exist
      const estimatesDir = path.join('uploads/estimates/');
      if (!fs.existsSync(estimatesDir)) {
        fs.mkdirSync(estimatesDir, { recursive: true });
      }
      
      // Save PDF to estimates directory
      const pdfPath = path.join(estimatesDir, `estimate-${estimate.id}.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      
      // Verify the file was written correctly
      const stats = fs.statSync(pdfPath);
      if (stats.size === 0) {
        throw new Error('Written PDF file is empty');
      }
      
      console.log(`PDF regenerated successfully for estimate ${estimateId}, size: ${stats.size} bytes`);
      
      // Update estimate with PDF path
      await req.app.locals.db.query(
        'UPDATE estimates SET pdf_path = $1 WHERE id = $2',
        [pdfPath, estimate.id]
      );
      
      res.json({ 
        message: 'PDF regenerated successfully', 
        pdf_path: pdfPath,
        file_size: stats.size 
      });
    } catch (pdfError) {
      console.error('Failed to regenerate PDF for estimate:', pdfError);
      return res.status(500).json({ 
        message: 'Failed to regenerate PDF', 
        error: pdfError.message,
        estimate_id: estimate.id 
      });
    }

  } catch (error) {
    console.error('Regenerate estimate PDF error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates/:id/send-email - Send estimate via email
router.post('/:id/send-email', [
  body('recipient_email')
    .isEmail()
    .withMessage('Valid recipient email is required'),
  body('sender_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Sender name must be between 1 and 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.id);
    const { recipient_email, sender_name } = req.body;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get estimate details
    const estimateResult = await req.app.locals.db.query(
      `SELECT e.*, p.name as project_name, c.name as customer_name
       FROM estimates e
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE e.id = $1`,
      [estimateId]
    );

    if (estimateResult.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const estimate = estimateResult.rows[0];

    // Get sender name from user if not provided
    const finalSenderName = sender_name || req.user.username || 'AmpTrack';

    // Check if email service is available
    if (!EmailService.isAvailable()) {
      return res.status(503).json({ 
        message: 'Email service is currently unavailable. Please contact support.',
        email_available: false
      });
    }

    // Send email with document attachment
    try {
      const emailResult = await EmailService.sendSimpleEstimateEmail(estimate, recipient_email, finalSenderName, req.app.locals.db);
      
      if (!emailResult.success) {
        return res.status(500).json({ 
          message: 'Failed to send email. Email service not configured.',
          error: emailResult.error
        });
      }
      
      // Update estimate status to 'sent' if it was 'draft'
      if (estimate.status === 'draft') {
        await req.app.locals.db.query(
          'UPDATE estimates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['sent', estimateId]
        );
      }

      res.json({
        message: 'Estimate sent successfully via email',
        recipient: recipient_email
      });

    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({ 
        message: 'Failed to send email. Please check your email configuration.',
        error: emailError.message 
      });
    }

  } catch (error) {
    console.error('Send estimate email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/estimates/project/:projectId - Get estimates by project ID
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const estimatesResult = await req.app.locals.db.query(
      `SELECT e.*, u.username as created_by_username, p.name as project_name,
              c.name as customer_name
       FROM estimates e
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN projects p ON e.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE e.project_id = $1
       ORDER BY e.created_at DESC`,
      [projectId]
    );

    // Convert decimal values to numbers for each estimate
    const estimates = estimatesResult.rows.map(estimate => ({
      ...estimate,
      total_amount: parseFloat(estimate.total_amount) || 0
    }));

    res.json({ estimates });

  } catch (error) {
    console.error('Get project estimates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
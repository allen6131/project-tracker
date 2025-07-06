const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = express.Router();

// All file routes require authentication
router.use(authenticateToken);
router.use(requireActive);

// GET /api/files/:fileId/download - Download a specific file
router.get('/:fileId/download', async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const result = await req.app.locals.db.query('SELECT * FROM project_files WHERE id = $1', [fileId]);
    const file = result.rows[0];

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // In a future implementation, check if user has access to private files.
    // For now, any authenticated user can download any file they can see.
    const filePath = path.resolve(file.file_path);
    res.download(filePath, file.original_name);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/files/:fileId - Delete a file
router.delete('/:fileId', async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);

    if (isNaN(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const fileResult = await req.app.locals.db.query('SELECT * FROM project_files WHERE id = $1', [fileId]);
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Optional: Add logic to ensure only admins or the user who uploaded the file can delete it.
    // For now, any authenticated user can delete.
    
    const deleteResult = await req.app.locals.db.query('DELETE FROM project_files WHERE id = $1 RETURNING *', [fileId]);
    
    // Delete the actual file from the server
    fs.unlink(path.resolve(file.file_path), (err) => {
      if (err) {
        // Log the error, but don't block the response as the DB record is already deleted.
        console.error('Error deleting file from filesystem:', err);
      }
    });

    res.json({ message: 'File deleted successfully', deletedFile: deleteResult.rows[0] });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/files/:fileId - Update file properties (e.g., is_public)
router.put('/:fileId', async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const { is_public } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    if (typeof is_public !== 'boolean') {
      return res.status(400).json({ message: 'Invalid value for is_public. It must be a boolean.' });
    }

    // Optional: Add logic here to ensure only admins can change file status.
    
    const result = await req.app.locals.db.query(
      'UPDATE project_files SET is_public = $1 WHERE id = $2 RETURNING *',
      [is_public, fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({ message: 'File updated successfully', file: result.rows[0] });

  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/files/:fileId/move - Move a file to a different folder
router.put('/:fileId/move', async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    const { folder_id } = req.body;

    if (isNaN(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    // Get the file to verify it exists and get the project_id
    const fileResult = await req.app.locals.db.query(
      'SELECT * FROM project_files WHERE id = $1',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];
    let finalFolderId = null;

    // If folder_id is provided, validate it belongs to the same project
    if (folder_id) {
      const folderIdInt = parseInt(folder_id);
      if (!isNaN(folderIdInt)) {
        const folderResult = await req.app.locals.db.query(
          'SELECT id FROM project_folders WHERE id = $1 AND project_id = $2',
          [folderIdInt, file.project_id]
        );
        if (folderResult.rows.length > 0) {
          finalFolderId = folderIdInt;
        } else {
          return res.status(400).json({ message: 'Invalid folder ID or folder does not belong to this project' });
        }
      }
    }

    // Update the file's folder
    const result = await req.app.locals.db.query(
      'UPDATE project_files SET folder_id = $1 WHERE id = $2 RETURNING *',
      [finalFolderId, fileId]
    );

    res.json({ message: 'File moved successfully', file: result.rows[0] });

  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireActive } = require('../middleware/auth');

const router = express.Router();

// All todo routes require authentication
router.use(authenticateToken);
router.use(requireActive);

// GET /api/todolists/all - Get all todo lists from all projects
router.get('/todolists/all', async (req, res) => {
    try {
        const query = `
            SELECT 
                tl.id,
                tl.project_id,
                tl.title,
                tl.created_at,
                p.name as project_name,
                p.address as project_location,
                p.status as project_status
            FROM todo_lists tl
            JOIN projects p ON tl.project_id = p.id
            ORDER BY tl.created_at DESC
        `;
        
        const listsResult = await req.app.locals.db.query(query);
        
        // For each list, get its items with assigned user information
        const lists = listsResult.rows;
        for (let i = 0; i < lists.length; i++) {
            const itemsResult = await req.app.locals.db.query(
                `SELECT ti.*, u.username as assigned_username, u.role as assigned_user_role 
                 FROM todo_items ti 
                 LEFT JOIN users u ON ti.assigned_to = u.id 
                 WHERE ti.todo_list_id = $1 
                 ORDER BY ti.created_at ASC`, 
                [lists[i].id]
            );
            lists[i].items = itemsResult.rows;
        }

        res.json({ todoLists: lists });
    } catch (error) {
        console.error('Get all todo lists error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// TODO LISTS

// GET /api/projects/:projectId/todolists - Get all lists for a project
router.get('/projects/:projectId/todolists', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Invalid project ID' });
        }

        const listsResult = await req.app.locals.db.query(
            'SELECT * FROM todo_lists WHERE project_id = $1 ORDER BY created_at ASC', 
            [projectId]
        );

        // For each list, get its items with assigned user information
        const lists = listsResult.rows;
        for (let i = 0; i < lists.length; i++) {
            const itemsResult = await req.app.locals.db.query(
                `SELECT ti.*, u.username as assigned_username, u.role as assigned_user_role 
                 FROM todo_items ti 
                 LEFT JOIN users u ON ti.assigned_to = u.id 
                 WHERE ti.todo_list_id = $1 
                 ORDER BY ti.created_at ASC`, 
                [lists[i].id]
            );
            lists[i].items = itemsResult.rows;
        }

        res.json(lists);
    } catch (error) {
        console.error('Get todo lists error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/projects/:projectId/todolists - Create a new todo list
router.post('/projects/:projectId/todolists', [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title must be 255 characters or less')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            return res.status(400).json({ message: 'Invalid project ID' });
        }
        const { title } = req.body;
        
        const result = await req.app.locals.db.query(
            'INSERT INTO todo_lists (project_id, title) VALUES ($1, $2) RETURNING *',
            [projectId, title]
        );
        const newList = result.rows[0];
        newList.items = []; // Return new list with empty items array
        res.status(201).json(newList);
    } catch (error) {
        console.error('Create todo list error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT /api/todolists/:listId - Update a todo list
router.put('/todolists/:listId', [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }).withMessage('Title must be 255 characters or less')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const listId = parseInt(req.params.listId);
        if (isNaN(listId)) {
            return res.status(400).json({ message: 'Invalid list ID' });
        }
        const { title } = req.body;

        const result = await req.app.locals.db.query(
            'UPDATE todo_lists SET title = $1 WHERE id = $2 RETURNING *',
            [title, listId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Todo list not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update todo list error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE /api/todolists/:listId - Delete a todo list
router.delete('/todolists/:listId', async (req, res) => {
    try {
        const listId = parseInt(req.params.listId);
        if (isNaN(listId)) {
            return res.status(400).json({ message: 'Invalid list ID' });
        }

        const result = await req.app.locals.db.query('DELETE FROM todo_lists WHERE id = $1 RETURNING *', [listId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Todo list not found' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Delete todo list error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// TODO ITEMS

// POST /api/todolists/:listId/items - Create a new todo item
router.post('/todolists/:listId/items', [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('assigned_to').optional().isInt().withMessage('Assigned to must be a valid user ID'),
    body('due_date').optional().isISO8601().withMessage('Due date must be a valid date (YYYY-MM-DD)')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const listId = parseInt(req.params.listId);
        if (isNaN(listId)) {
            return res.status(400).json({ message: 'Invalid list ID' });
        }
        const { content, assigned_to, due_date } = req.body;

        // Validate assigned_to user exists and is active if provided
        if (assigned_to) {
            const userCheck = await req.app.locals.db.query(
                'SELECT id FROM users WHERE id = $1 AND is_active = true',
                [assigned_to]
            );
            if (userCheck.rows.length === 0) {
                return res.status(400).json({ message: 'Invalid or inactive user for assignment' });
            }
        }

        // Convert due_date to proper format or null
        const formattedDueDate = due_date && due_date.trim() ? due_date : null;

        const result = await req.app.locals.db.query(
            'INSERT INTO todo_items (todo_list_id, content, assigned_to, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
            [listId, content, assigned_to || null, formattedDueDate]
        );

        // Get the created item with user information
        const itemWithUser = await req.app.locals.db.query(
            `SELECT ti.*, u.username as assigned_username, u.role as assigned_user_role 
             FROM todo_items ti 
             LEFT JOIN users u ON ti.assigned_to = u.id 
             WHERE ti.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json(itemWithUser.rows[0]);
    } catch (error) {
        console.error('Create todo item error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT /api/todoitems/:itemId - Update a todo item
router.put('/todoitems/:itemId', [
    body('content').optional().trim().notEmpty().withMessage('Content cannot be empty'),
    body('is_completed').optional().isBoolean().withMessage('is_completed must be a boolean'),
    body('assigned_to').optional().custom((value) => {
        if (value === null || value === '') return true; // Allow null/empty for unassigning
        if (!Number.isInteger(Number(value))) throw new Error('Assigned to must be a valid user ID or null');
        return true;
    }),
    body('due_date').optional().custom((value) => {
        if (value === null || value === '') return true; // Allow null/empty for removing due date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Due date must be in YYYY-MM-DD format or null');
        const date = new Date(value);
        if (isNaN(date.getTime())) throw new Error('Due date must be a valid date');
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const itemId = parseInt(req.params.itemId);
        if (isNaN(itemId)) {
            return res.status(400).json({ message: 'Invalid item ID' });
        }

        const { content, is_completed, assigned_to, due_date } = req.body;

        // Fetch the current item
        const currentItemRes = await req.app.locals.db.query('SELECT * FROM todo_items WHERE id = $1', [itemId]);
        if (currentItemRes.rows.length === 0) {
            return res.status(404).json({ message: 'Todo item not found' });
        }
        const currentItem = currentItemRes.rows[0];

        // Validate assigned_to user exists and is active if provided and not null/empty
        const finalAssignedTo = assigned_to === null || assigned_to === '' ? null : (assigned_to !== undefined ? parseInt(assigned_to) : currentItem.assigned_to);
        if (finalAssignedTo) {
            const userCheck = await req.app.locals.db.query(
                'SELECT id FROM users WHERE id = $1 AND is_active = true',
                [finalAssignedTo]
            );
            if (userCheck.rows.length === 0) {
                return res.status(400).json({ message: 'Invalid or inactive user for assignment' });
            }
        }

        // Handle due_date - convert empty string to null, preserve existing if undefined
        const finalDueDate = due_date === null || due_date === '' ? null : (due_date !== undefined ? due_date : currentItem.due_date);

        // Prepare update query
        const finalContent = content !== undefined ? content : currentItem.content;
        const finalCompleted = is_completed !== undefined ? is_completed : currentItem.is_completed;
        
        const result = await req.app.locals.db.query(
            'UPDATE todo_items SET content = $1, is_completed = $2, assigned_to = $3, due_date = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
            [finalContent, finalCompleted, finalAssignedTo, finalDueDate, itemId]
        );

        // Get the updated item with user information
        const itemWithUser = await req.app.locals.db.query(
            `SELECT ti.*, u.username as assigned_username, u.role as assigned_user_role 
             FROM todo_items ti 
             LEFT JOIN users u ON ti.assigned_to = u.id 
             WHERE ti.id = $1`,
            [itemId]
        );

        res.json(itemWithUser.rows[0]);
    } catch (error) {
        console.error('Update todo item error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE /api/todoitems/:itemId - Delete a todo item
router.delete('/todoitems/:itemId', async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId);
        if (isNaN(itemId)) {
            return res.status(400).json({ message: 'Invalid item ID' });
        }
        
        const result = await req.app.locals.db.query('DELETE FROM todo_items WHERE id = $1 RETURNING *', [itemId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Todo item not found' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        console.error('Delete todo item error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 
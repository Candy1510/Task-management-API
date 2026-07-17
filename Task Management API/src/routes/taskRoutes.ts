import { Router } from 'express';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listTasks);
/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: List tasks (own tasks; ADMIN sees all). Cached in Redis for 60s.
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Array of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Task' }
 *       401: { description: Not authenticated }
 */
router.post('/', createTask);
/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a specific task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200: { description: Task found }
 *       404: { description: Task not found }
 *       401: { description: Not authenticated }
 */
router.get('/:id', getTask);
/**
 * @openapi
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a specific task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskUpdate'
 *     responses:
 *       200: { description: Task updated }
 *       404: { description: Task not found }
 *       401: { description: Not authenticated }
 */
router.put('/:id', updateTask);
/**
* @openapi
* /api/tasks/{id}:
*   delete:
*     summary: Delete a specific task
*     tags: [Tasks]
*     security: [{ bearerAuth: [] }]
*     parameters:
*       - name: id
*         in: path
*         required: true
*         schema:
*           type: string
*     responses:
*       204: { description: Task deleted }
*       404: { description: Task not found }
*       401: { description: Not authenticated }
*/
router.delete('/:id', deleteTask);

// Example admin-only route
router.delete('/admin/:id', authorize('ADMIN'), deleteTask);

export default router;

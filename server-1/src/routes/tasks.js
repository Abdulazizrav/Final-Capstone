const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper to publish events to Redis
async function publishWorkspaceEvent(redis, eventName, data) {
  if (redis && redis.isOpen) {
    try {
      const payload = JSON.stringify({ event: eventName, ...data, timestamp: new Date().toISOString() });
      await redis.publish('workspace:events', payload);
      console.log(`[Redis Pub] Published ${eventName} to channel 'workspace:events'`);
    } catch (err) {
      console.error('Failed to publish Redis event:', err);
    }
  }
}

// Create a Task
router.post('/', auth, async (req, res) => {
  const { title, description, status, priority, dueDate, projectId, assigneeId } = req.body;

  if (!title || !projectId) {
    return res.status(400).json({ error: 'Title and Project ID are required.' });
  }

  try {
    const project = await req.prisma.project.findUnique({
      where: { id: parseInt(projectId) }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const task = await req.prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: parseInt(projectId),
        assigneeId: assigneeId ? parseInt(assigneeId) : null
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    // 1. Emit socket event for instant client-side update
    req.io.to(`project:${projectId}`).emit('task_created', task);

    // 2. Publish microservice event via Redis Pub/Sub
    await publishWorkspaceEvent(req.redis, 'TASK_CREATED', {
      projectId: task.projectId,
      taskId: task.id,
      status: task.status,
      priority: task.priority
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Server error creating task.' });
  }
});

// Update a Task (Title, Description, Status, Priority, Assignee, etc.)
router.put('/:id', auth, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, description, status, priority, dueDate, assigneeId } = req.body;

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID.' });
  }

  try {
    const existingTask = await req.prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const updatedTask = await req.prisma.task.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? title : existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        status: status !== undefined ? status : existingTask.status,
        priority: priority !== undefined ? priority : existingTask.priority,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingTask.dueDate,
        assigneeId: assigneeId !== undefined ? (assigneeId ? parseInt(assigneeId) : null) : existingTask.assigneeId
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    // 1. Emit socket event
    req.io.to(`project:${updatedTask.projectId}`).emit('task_updated', updatedTask);

    // 2. Publish microservice event via Redis
    await publishWorkspaceEvent(req.redis, 'TASK_UPDATED', {
      projectId: updatedTask.projectId,
      taskId: updatedTask.id,
      status: updatedTask.status,
      oldStatus: existingTask.status,
      priority: updatedTask.priority,
      assigneeId: updatedTask.assigneeId
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Server error updating task.' });
  }
});

// Delete a Task
router.delete('/:id', auth, async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID.' });
  }

  try {
    const task = await req.prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await req.prisma.task.delete({ where: { id: taskId } });

    // 1. Emit socket event
    req.io.to(`project:${task.projectId}`).emit('task_deleted', { id: taskId, projectId: task.projectId });

    // 2. Publish microservice event via Redis
    await publishWorkspaceEvent(req.redis, 'TASK_DELETED', {
      projectId: task.projectId,
      taskId: task.id,
      status: task.status
    });

    res.status(200).json({ message: 'Task deleted successfully.', taskId });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Server error deleting task.' });
  }
});

module.exports = router;

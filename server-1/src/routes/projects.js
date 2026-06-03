const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all projects the user is involved with
router.get('/', auth, async (req, res) => {
  try {
    const projects = await req.prisma.project.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { tasks: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Server error fetching projects.' });
  }
});

// Get detailed project workspace info: including tasks and recent chat messages
router.get('/:id', auth, async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID.' });
  }

  try {
    const project = await req.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Format chat messages slightly to simplify UI consumption
    const messages = project.messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      userId: msg.userId,
      username: msg.user.name,
      createdAt: msg.createdAt
    }));

    res.status(200).json({
      ...project,
      messages
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Server error fetching project details.' });
  }
});

// Create a new project
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  try {
    const newProject = await req.prisma.project.create({
      data: {
        name,
        description,
        ownerId: req.user.id
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Seed dummy task cards for new projects to make it interactive out-of-the-box
    await req.prisma.task.createMany({
      data: [
        { title: 'Define Project MVP Scope', description: 'Align with stakeholders on the core goals and tech stack.', status: 'TODO', priority: 'HIGH', projectId: newProject.id },
        { title: 'Setup CI/CD Pipeline', description: 'Configure automated actions for testing and container deployment.', status: 'TODO', priority: 'MEDIUM', projectId: newProject.id },
        { title: 'Create Wireframes', description: 'Design initial sketches for UI layouts and data charts.', status: 'IN_PROGRESS', priority: 'LOW', projectId: newProject.id },
        { title: 'Initialize Repository', description: 'Create repo and push boilerplate code templates.', status: 'DONE', priority: 'MEDIUM', projectId: newProject.id }
      ]
    });

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Server error creating project.' });
  }
});

// Delete a project
router.delete('/:id', auth, async (req, res) => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID.' });
  }

  try {
    const project = await req.prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this project.' });
    }

    await req.prisma.project.delete({ where: { id: projectId } });
    res.status(200).json({ message: 'Project and all associated tasks/messages deleted successfully.' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error deleting project.' });
  }
});

module.exports = router;

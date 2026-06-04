'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

function formatDueDate(dueDate) {
  if (!dueDate) return 'No due date';

  const normalized = typeof dueDate === 'string' && dueDate.includes('T')
    ? dueDate
    : `${dueDate}T00:00:00Z`;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(normalized));
}
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ArrowLeft, MessageSquare, PieChart as ChartIcon, Kanban,
  Send, Plus, Trash2, Shield, Circle, User, Users, AlertCircle,
  Clock, CheckCircle2, ChevronRight, ChevronLeft, Loader2
} from 'lucide-react';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = parseInt(params.id);

  const { token, user, activePresence, setActivePresence, hydrateAuth, isHydrated } = useStore();
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' | 'analytics'
  const socketRef = useRef(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Workspace UI states
  const [tasks, setTasks] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Task creation modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState('');

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // Authentication Guard
  useEffect(() => {
    if (isHydrated && !token) {
      router.push('/login');
    }
  }, [isHydrated, token, router]);

  // Fetch Project Details (REST server-1)
  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch project details');
      return res.json();
    },
    enabled: isHydrated && !!token && !isNaN(projectId),
  });

  // Sync initial tasks and chat messages from API response.
  // Keep the live socket list intact on refetches so messages do not disappear.
  useEffect(() => {
    if (!project) return;

    const normalizedMessages = (project.messages || []).map((msg) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.userId,
      username: msg.username || msg.user?.name || 'Unknown user',
      createdAt: msg.createdAt,
    }));

    setTasks(project.tasks || []);
    setChatMessages((prev) => (prev.length > 0 ? prev : normalizedMessages));
  }, [project]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Socket.io Real-time integrations
  useEffect(() => {
    if (!token || !user || isNaN(projectId)) return;

    // Establish WebSocket connection via Gateway
    const socketUrl = window.location.origin;
    const socketConn = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,   // Never give up — recovers from Docker restarts & network blips
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,       // Cap backoff at 5s so reconnects stay snappy
      timeout: 10000,
      forceNew: true,
    });

    socketRef.current = socketConn;

    socketConn.on('connect', () => {
      console.log('Connected to Workspace Sockets');
      setSocketConnected(true);
      socketConn.emit('join_project', {
        projectId,
        userId: user.id,
        username: user.name
      });
    });

    socketConn.on('disconnect', () => {
      setSocketConnected(false);
    });

    socketConn.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
    });

    // Real-time Event Listeners
    socketConn.on('presence_update', (users) => {
      setActivePresence(users);
    });

    socketConn.on('new_message', (msg) => {
      const normalizedMsg = {
        ...msg,
        username: msg.username || msg.user?.name || 'Unknown user',
      };

      setChatMessages((prev) => {
        // Use id-based dedup only — server always provides the persisted DB id
        if (prev.some((existing) => existing.id === normalizedMsg.id)) {
          return prev;
        }
        return [...prev, normalizedMsg];
      });
    });

    socketConn.on('task_created', (newTask) => {
      setTasks((prev) => [...prev, newTask]);
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId] });
    });

    socketConn.on('task_updated', (updatedTask) => {
      setTasks((prev) => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId] });
    });

    socketConn.on('task_deleted', ({ id }) => {
      setTasks((prev) => prev.filter(t => t.id !== id));
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId] });
    });

    return () => {
      socketConn.disconnect();
    };
  }, [token, user, projectId, setActivePresence, queryClient]);

  // Fetch Analytics from GraphQL Microservice (server-2)
  const { data: analytics, refetch: refetchAnalytics, isLoading: isAnalyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: async () => {
      const gqlQuery = `
        query GetAnalytics($projectId: Int!) {
          projectAnalytics(projectId: $projectId) {
            projectId
            projectName
            totalTasks
            completedTasks
            completionPercentage
            overdueTasksCount
            activeUsersCount
            statusDistribution {
              status
              count
            }
            priorityDistribution {
              priority
              count
            }
            workloadDistribution {
              assigneeName
              taskCount
            }
          }
        }
      `;
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { projectId }
        })
      });
      if (!res.ok) throw new Error(`GraphQL service returned HTTP ${res.status} — is server-2 running?`);
      const resData = await res.json();
      if (resData.errors) throw new Error(resData.errors[0].message);
      return resData.data.projectAnalytics;
    },
    enabled: !!token && !isNaN(projectId) && activeTab === 'analytics',
    retry: 2,
    retryDelay: 1500,
  });

  // Trigger refetch of analytics when entering tab (only when not already loading)
  useEffect(() => {
    if (activeTab === 'analytics' && !isAnalyticsLoading) {
      refetchAnalytics();
    }
  }, [activeTab]); // intentionally omit refetchAnalytics/isAnalyticsLoading to avoid refetch loops

  // Mutators for Tasks (via REST server-1)
  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...taskData, projectId })
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskPriority('MEDIUM');
      setTaskDueDate('');
    }
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }) => {
      const res = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update task status');
      return res.json();
    },
    onMutate: ({ taskId, newStatus }) => {
      // Optimistically update local state immediately — no refresh needed
      setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    },
    onError: (_err, { taskId }, _ctx) => {
      // Revert on failure by re-fetching project data
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onSuccess: (updatedTask) => {
      // Ensure local state reflects what the server confirmed
      setTasks((prev) => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId] });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    }
  });

  // Actions
  const handleSendChat = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const socket = socketRef.current;
    if (!socket) {
      console.warn('Socket not initialised yet');
      return;
    }
    socket.emit('send_message', {
      projectId,
      userId: user.id,
      username: user.name,
      content: trimmed
    });
    setChatInput('');
  };

  const handleCreateTaskSubmit = (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      priority: taskPriority,
      dueDate: taskDueDate || null
    });
  };

  // Status transitions: Helper buttons for cards
  const shiftTaskStatus = (taskId, currentStatus, direction) => {
    const statuses = ['TODO', 'IN_PROGRESS', 'DONE'];
    const idx = statuses.indexOf(currentStatus);
    let nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < statuses.length) {
      updateTaskStatusMutation.mutate({ taskId, newStatus: statuses[nextIdx] });
    }
  };

  if (isProjectLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Synchronizing workspace...</p>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h4 className="text-xl font-bold text-white mb-2">Workspace Load Failed</h4>
        <p className="text-zinc-400 text-sm max-w-sm mb-6">
          The workspace link is invalid or you do not have permission to view it.
        </p>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  // Filters for board columns
  const todoTasks = tasks.filter(t => t.status === 'TODO');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const doneTasks = tasks.filter(t => t.status === 'DONE');

  // Chart configuration colors
  const COLORS = ['#6366f1', '#14b8a6', '#ec4899', '#a855f7', '#f59e0b'];

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Glow backgrounds */}
      <div className="glow-indigo top-[10%] left-[-100px]"></div>
      <div className="glow-teal bottom-[20%] right-[-100px]"></div>

      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-extrabold text-lg text-white leading-none mb-1">{project.name}</h2>
              <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> Microservice Orchestrated
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'kanban'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo/20'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban Board
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo/20'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <ChartIcon className="w-3.5 h-3.5" />
              Workspace Analytics (GraphQL)
            </button>
          </div>

          {/* User Profile info */}
          <div className="text-right hidden md:block">
            <p className="text-xs text-zinc-500">Demo User</p>
            <p className="text-sm font-semibold text-white">{user?.name}</p>
          </div>
        </div>
      </header>

      {/* Main Split Screen Body */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-6 py-6 gap-6 relative z-10 overflow-hidden">

        {/* Left Side: Dynamic Workspace Area (Kanban or Analytics) */}
        <div className="flex-1 min-w-0">
          {activeTab === 'kanban' && (
            <div className="space-y-6">
              {/* Kanban Toolbar */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-sm text-zinc-400 font-medium">
                  Columns reflect live databases. Drag events simulated.
                </span>
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-indigo/20 shadow-md transition"
                >
                  <Plus className="w-4 h-4" /> Add Task Card
                </button>
              </div>

              {/* Board Columns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

                {/* Column: TODO */}
                <div className="glass-panel rounded-xl p-4 flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Circle className="w-3.5 h-3.5 text-zinc-500 fill-zinc-500/20" />
                      <h4 className="font-bold text-white text-sm">To Do</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/5 text-zinc-400">
                      {todoTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {todoTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onShift={(dir) => shiftTaskStatus(task.id, task.status, dir)}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                      />
                    ))}
                    {todoTasks.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-10 italic">Column is empty.</p>
                    )}
                  </div>
                </div>

                {/* Column: IN PROGRESS */}
                <div className="glass-panel rounded-xl p-4 flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <h4 className="font-bold text-white text-sm">In Progress</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400">
                      {inProgressTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {inProgressTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onShift={(dir) => shiftTaskStatus(task.id, task.status, dir)}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                      />
                    ))}
                    {inProgressTasks.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-10 italic">Column is empty.</p>
                    )}
                  </div>
                </div>

                {/* Column: DONE */}
                <div className="glass-panel rounded-xl p-4 flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      <h4 className="font-bold text-white text-sm">Done</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 text-teal-400">
                      {doneTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {doneTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onShift={(dir) => shiftTaskStatus(task.id, task.status, dir)}
                        onDelete={() => deleteTaskMutation.mutate(task.id)}
                      />
                    ))}
                    {doneTasks.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-10 italic">Column is empty.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* GraphQL microservice metrics summary cards */}
              {isAnalyticsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-sm text-zinc-500">Querying Server 2 GraphQL endpoints...</p>
                </div>
              ) : analyticsError ? (
                <div className="py-20 text-center glass-panel rounded-xl flex flex-col items-center gap-4">
                  <AlertCircle className="w-10 h-10 text-pink-500" />
                  <div>
                    <p className="text-white font-bold mb-1">GraphQL Analytics Unavailable</p>
                    <p className="text-zinc-500 text-xs max-w-sm mx-auto">{analyticsError.message}</p>
                  </div>
                  <button
                    onClick={() => refetchAnalytics()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    <Loader2 className="w-3.5 h-3.5" /> Retry GraphQL Query
                  </button>
                </div>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="glass-panel rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Total Tasks</p>
                      <h4 className="text-2xl font-bold text-white mt-1">{analytics.totalTasks}</h4>
                    </div>
                    <div className="glass-panel rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Completion Rate</p>
                      <h4 className="text-2xl font-bold text-teal-400 mt-1">{analytics.completionPercentage}%</h4>
                    </div>
                    <div className="glass-panel rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Overdue Alerts</p>
                      <h4 className="text-2xl font-bold text-pink-500 mt-1">{analytics.overdueTasksCount}</h4>
                    </div>
                    <div className="glass-panel rounded-xl p-4 shadow-sm">
                      <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Active Workspace Users</p>
                      <h4 className="text-2xl font-bold text-indigo-400 mt-1">{analytics.activeUsersCount}</h4>
                    </div>
                  </div>

                  {/* Analytics charts panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Status pie chart */}
                    <div className="glass-panel rounded-xl p-6 flex flex-col h-[320px]">
                      <h4 className="text-sm font-bold text-white mb-4">Task Status Distribution</h4>
                      <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.statusDistribution}
                              dataKey="count"
                              nameKey="status"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              labelLine={false}
                              label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                            >
                              {analytics.statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Priority Bar Chart */}
                    <div className="glass-panel rounded-xl p-6 flex flex-col h-[320px]">
                      <h4 className="text-sm font-bold text-white mb-4">Task Priority Distribution</h4>
                      <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.priorityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="priority" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                            <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Team workload bar chart */}
                    <div className="col-span-full glass-panel rounded-xl p-6 flex flex-col h-[300px]">
                      <h4 className="text-sm font-bold text-white mb-4">Workspace Workload (Tasks Per Member)</h4>
                      <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.workloadDistribution} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                            <XAxis type="number" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                            <YAxis type="category" dataKey="assigneeName" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Bar dataKey="taskCount" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center glass-panel rounded-xl">
                  <p className="text-zinc-500">No analytics data could be computed.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Socket.io Chat & Team Presence sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-6">

          {/* Active Members Online Presence Widget */}
          <div className="glass-panel rounded-xl p-4 flex flex-col">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              Active Collaborators
            </h3>

            <div className="space-y-2">
              {activePresence && activePresence.length > 0 ? (
                activePresence.map((usr) => (
                  <div key={usr.id} className="flex items-center gap-2.5 bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                        {usr.username[0].toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-teal-400 border-2 border-[#09090b] animate-pulse"></span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-200">{usr.username}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-600 italic">No one online.</p>
              )}
            </div>
          </div>

          {/* Project Room Chat Logs */}
          <div className="glass-panel rounded-xl flex flex-col h-[400px]">
            <h3 className="text-sm font-bold text-white p-4 border-b border-white/5 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Project Live Stream
            </h3>

            {/* Scrollable messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg) => {
                const isMe = msg.userId === user?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-zinc-500 mb-0.5 px-1">{msg.username}</span>
                    <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white/5 text-zinc-200 rounded-tl-none border border-white/5'
                      }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Box */}
            <div className="p-3 border-t border-white/5 flex flex-col gap-1.5">
              {!socketConnected && (
                <p className="text-[10px] text-yellow-500/80 text-center">Connecting to live chat...</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={socketConnected ? "Send a live message..." : "Connecting..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat(e);
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-xs glass-input"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 shadow-premium relative">
            <h3 className="text-xl font-bold text-white mb-4">Add Task Card</h3>

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Card Title</label>
                <input
                  type="text"
                  required
                  placeholder="Task topic"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg text-sm glass-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Task details"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg text-sm glass-input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm glass-input select-dark"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm glass-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition flex items-center gap-1.5"
                >
                  {createTaskMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Kanban Task Card
function TaskCard({ task, onShift, onDelete }) {
  // Styles for Priority badges
  const priColor = {
    LOW: 'bg-green-500/10 text-green-400 border-green-500/10',
    MEDIUM: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10',
    HIGH: 'bg-pink-500/10 text-pink-400 border-pink-500/10',
  }[task.priority] || 'bg-zinc-500/10 text-zinc-400';

  return (
    <div className="group glass-card rounded-lg p-4 shadow-sm flex flex-col relative transition-all border border-white/5">
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider border ${priColor}`}>
          {task.priority}
        </span>

        {/* Delete button (shows on hover) */}
        <button
          onClick={onDelete}
          className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5"
          title="Delete Task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <h5 className="font-extrabold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors mb-1">
        {task.title}
      </h5>
      {task.description && (
        <p className="text-zinc-400 text-xs line-clamp-2 mb-4 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer operations */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Clock className="w-3 h-3 text-indigo-400" />
          <span>{formatDueDate(task.dueDate)}</span>
        </div>

        {/* Navigation arrow buttons to move card status */}
        <div className="flex items-center gap-1.5">
          {task.status !== 'TODO' && (
            <button
              onClick={() => onShift(-1)}
              className="p-1 rounded bg-white/5 border border-white/5 hover:bg-indigo-600 hover:text-white transition text-zinc-400"
              title="Move Left"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          {task.status !== 'DONE' && (
            <button
              onClick={() => onShift(1)}
              className="p-1 rounded bg-white/5 border border-white/5 hover:bg-indigo-600 hover:text-white transition text-zinc-400"
              title="Move Right"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

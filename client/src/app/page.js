'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, LogOut, Folder, Users, Activity, Loader2, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, logout, hydrateAuth, isHydrated } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // Authentication check
  useEffect(() => {
    if (isHydrated && !token) {
      router.push('/login');
    }
  }, [isHydrated, token, router]);

  // Fetch projects list
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
    enabled: isHydrated && !!token,
  });

  // Create Project mutation
  const createMutation = useMutation({
    mutationFn: async (projData) => {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projData)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setNewProjName('');
      setNewProjDesc('');
      setCreateError('');
    },
    onError: (err) => {
      setCreateError(err.message);
    }
  });

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjName) return;
    createMutation.mutate({ name: newProjName, description: newProjDesc });
  };

  if (!isHydrated || !token || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Loading your spaces...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-12">
      {/* Glow backgrounds */}
      <div className="glow-indigo top-[-100px] left-[-100px]"></div>
      <div className="glow-teal bottom-[10%] right-[5%]"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-teal-400 flex items-center justify-center shadow-md">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              CoSphere
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-400 font-medium">Signed in as</p>
              <p className="text-sm font-semibold text-white">{user?.name}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 mt-10 relative z-10">

        {/* Welcome Section */}
        <div className="glass-panel rounded-2xl p-8 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-premium">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Welcome back, {user?.name.split(' ')[0]} 👋
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl">
              Track tasks collaboratively in real-time, view live dashboard analytics computed by Server 2, and stay in touch with your team.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-indigo shadow-lg transition"
          >
            <Plus className="w-5 h-5" />
            Create Workspace
          </button>
        </div>

        {/* Workspace List Header */}
        <div className="flex items-center gap-3 mb-6">
          <Folder className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-white">Active Project Workspaces</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/5 text-zinc-400">
            {projects?.length || 0} Total
          </span>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="group relative cursor-pointer glass-card rounded-xl p-6 shadow-md hover:scale-[1.01]"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-indigo-400" />
                </div>

                <h4 className="text-lg font-extrabold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                  {project.name}
                </h4>
                <p className="text-zinc-400 text-sm line-clamp-2 mb-6">
                  {project.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{project._count?.tasks || 0} Tasks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>Owner: {project.owner?.name.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-16 flex flex-col items-center justify-center glass-panel rounded-xl text-center">
              <Folder className="w-12 h-12 text-zinc-600 mb-4" />
              <h4 className="text-lg font-bold text-white mb-1">No Workspaces Found</h4>
              <p className="text-zinc-400 text-sm max-w-sm mb-6">
                You haven't created any workspaces yet. Create one now to start collaborating!
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition"
              >
                <Plus className="w-4 h-4" />
                Create Workspace
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 shadow-premium relative">
            <h3 className="text-xl font-bold text-white mb-4">Create New Project</h3>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Workspace Alpha"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg text-sm glass-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold">Description (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="What is this project workspace about?"
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg text-sm glass-input resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition flex items-center gap-1.5"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

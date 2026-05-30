import type { Context } from 'hono';
import type { Bindings, Folder, Requirement } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { createDb } from '../../db';
import { requirements, folders, testCaseRequirements } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

const icons = {
  plus: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`,
  sparkles: `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V21h2v-5.464M12 7a3 3 0 00-3 3"/></svg>`,
  refresh: `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18"/></svg>`,
  edit: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
  delete: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
  spinner: `<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`,
  checkmark: `<svg class="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`,
  pending: `<svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/></svg>`,
  info: `<svg class="w-16 h-16 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`
};

export async function requirementsPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  
  // Fetch requirements with counts of linked test cases
  const reqs = await db
    .select({
      id: requirements.id,
      reqId: requirements.reqId,
      title: requirements.title,
      description: requirements.description,
      status: requirements.status,
      createdAt: requirements.createdAt,
      testCaseCount: sql<number>`count(${testCaseRequirements.testCaseId})`,
    })
    .from(requirements)
    .leftJoin(testCaseRequirements, eq(requirements.id, testCaseRequirements.requirementId))
    .groupBy(requirements.id)
    .orderBy(requirements.reqId);
    
  // Fetch folders for mapping generated cases
  const allFolders = await db.select().from(folders);
  const canEdit = !!user;
  
  return c.html(
    <Layout user={user} currentPath="/requirements" title="Requirements Tracking">
      <div 
        class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
        x-data={`{
          // Modals
          createOpen: false,
          editOpen: false,
          deleteOpen: false,
          generatorOpen: false,
          
          // Form Fields
          currentId: null,
          currentReqId: '',
          title: '',
          description: '',
          status: 'Open',
          
          // AI Generator Specifics
          selectedFolderId: '',
          generationReqId: null,
          generationReqTitle: '',
          
          // Real-time progress loader state
          phaseReading: 'pending', // 'pending' | 'active' | 'complete'
          phaseScenarios: 'pending',
          phaseCreating: 'pending',
          creatingCurrent: 0,
          creatingTotal: 0,
          errorMessage: '',
          submitting: false,
          
          openCreateModal() {
            this.title = '';
            this.description = '';
            this.status = 'Open';
            this.errorMessage = '';
            this.createOpen = true;
          },
          
          openEditModal(req) {
            this.currentId = req.id;
            this.currentReqId = req.reqId;
            this.title = req.title;
            this.description = req.description || '';
            this.status = req.status || 'Open';
            this.errorMessage = '';
            this.editOpen = true;
          },
          
          openDeleteModal(req) {
            this.currentId = req.id;
            this.currentReqId = req.reqId;
            this.title = req.title;
            this.deleteOpen = true;
          },
          
          openGeneratorModal(req) {
            this.currentId = req.id;
            this.currentReqId = req.reqId;
            this.generationReqTitle = req.title;
            this.selectedFolderId = '';
            this.phaseReading = 'pending';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            this.creatingCurrent = 0;
            this.creatingTotal = 0;
            this.errorMessage = '';
            this.generatorOpen = true;
          },
          
          async createRequirement() {
            if (!this.title.trim() || this.submitting) return;
            this.submitting = true;
            try {
              const res = await fetch('/api/requirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: this.title.trim(),
                  description: this.description.trim() || null,
                  status: this.status
                })
              });
              if (res.ok) {
                window.location.reload();
              } else {
                const err = await res.json();
                this.errorMessage = err.error || 'Failed to create story';
                this.submitting = false;
              }
            } catch (e) {
              this.errorMessage = 'Connection failure. Please retry.';
              this.submitting = false;
            }
          },
          
          async saveRequirement() {
            if (!this.title.trim() || this.submitting) return;
            this.submitting = true;
            try {
              const res = await fetch('/api/requirements/' + this.currentId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: this.title.trim(),
                  description: this.description.trim() || null,
                  status: this.status
                })
              });
              if (res.ok) {
                window.location.reload();
              } else {
                const err = await res.json();
                this.errorMessage = err.error || 'Failed to update requirement';
                this.submitting = false;
              }
            } catch (e) {
              this.errorMessage = 'Connection error.';
              this.submitting = false;
            }
          },
          
          async deleteRequirement() {
            if (this.submitting) return;
            this.submitting = true;
            try {
              const res = await fetch('/api/requirements/' + this.currentId, {
                method: 'DELETE'
              });
              if (res.ok) {
                window.location.reload();
              } else {
                alert('Deletion failed');
                this.submitting = false;
              }
            } catch (e) {
              alert('Error while deleting');
              this.submitting = false;
            }
          },
          
          async runAIGeneration() {
            this.phaseReading = 'active';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            this.errorMessage = '';
            
            try {
              const res = await fetch('/api/requirements/' + this.currentId + '/generate-test-cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  folderId: this.selectedFolderId ? parseInt(this.selectedFolderId) : null
                })
              });
              
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                this.errorMessage = err.error || 'Test Case generation service unavailable.';
                this.phaseReading = 'pending';
                return;
              }
              
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  const cleanLine = line.trim();
                  if (cleanLine.startsWith('data: ')) {
                    try {
                      const payload = JSON.parse(cleanLine.slice(6));
                      
                      if (payload.status === 'reading') {
                        this.phaseReading = 'active';
                      } else if (payload.status === 'scenarios') {
                        this.phaseReading = 'complete';
                        this.phaseScenarios = 'active';
                      } else if (payload.status === 'creating') {
                        this.phaseReading = 'complete';
                        this.phaseScenarios = 'complete';
                        this.phaseCreating = 'active';
                        this.creatingCurrent = payload.current;
                        this.creatingTotal = payload.total;
                      } else if (payload.status === 'complete') {
                        this.phaseReading = 'complete';
                        this.phaseScenarios = 'complete';
                        this.phaseCreating = 'complete';
                        
                        // Close generator and refresh after a short success pause
                        setTimeout(() => {
                          this.generatorOpen = false;
                          window.location.reload();
                        }, 1200);
                      } else if (payload.status === 'error') {
                        this.errorMessage = payload.message || 'An error occurred during generation.';
                        break;
                      }
                    } catch (e) {
                      console.error('Error parsing SSE line', e);
                    }
                  }
                }
              }
            } catch (err) {
              this.errorMessage = 'Connection closed unexpectedly.';
            }
          }
        }`}
      >
        {/* Header */}
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-1 sm:mb-2">Requirements</h1>
            <p class="text-sm sm:text-base text-neutral-600">
              Track your user stories and automatically generate AI test cases linked to them.
            </p>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              icon={icons.plus}
              onClick="openCreateModal()"
            >
              New Story
            </Button>
          )}
        </div>

        {/* Requirements Table Card */}
        <Card padding={false}>
          {reqs.length === 0 ? (
            <div class="text-center py-12 px-4">
              <div class="mx-auto w-fit mb-4" dangerouslySetInnerHTML={{ __html: icons.info }} />
              <h3 class="text-base sm:text-lg font-semibold text-neutral-900 mb-2">No requirements found</h3>
              <p class="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
                Requirements represent features or user stories that require validation. Create one to begin generating test cases.
              </p>
              {canEdit && (
                <Button variant="primary" icon={icons.plus} onClick="openCreateModal()">
                  Add Your First Requirement
                </Button>
              )}
            </div>
          ) : (
            <div class="overflow-x-auto responsive-table">
              <table class="w-full border-collapse divide-y divide-neutral-200">
                <thead>
                  <tr class="bg-neutral-50 text-left">
                    <th class="px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider w-24">ID</th>
                    <th class="px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Title & Description</th>
                    <th class="px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider w-32">Status</th>
                    <th class="px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider w-40">Linked Cases</th>
                    <th class="px-6 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider w-64 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-200 bg-white">
                  {reqs.map((req) => {
                    const hasCases = req.testCaseCount > 0;
                    return (
                      <tr key={req.id} class="hover:bg-neutral-50/50 transition-colors">
                        {/* ID Column */}
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                            {req.reqId}
                          </span>
                        </td>
                        {/* Title Column */}
                        <td class="px-6 py-4">
                          <div class="text-sm font-semibold text-neutral-900 mb-0.5">{req.title}</div>
                          <div class="text-xs text-neutral-500 line-clamp-2 max-w-md">
                            {req.description || 'No description provided.'}
                          </div>
                        </td>
                        {/* Status Column */}
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
                            req.status === 'Implemented' ? 'bg-success-50 text-success-700 border-success-200' :
                            req.status === 'In Progress' ? 'bg-primary-50 text-primary-700 border-primary-200' :
                            req.status === 'Closed' ? 'bg-neutral-100 text-neutral-600 border-neutral-250' :
                            'bg-warning-50 text-warning-700 border-warning-200'
                          }`}>
                            {req.status || 'Open'}
                          </span>
                        </td>
                        {/* Linked Cases Column */}
                        <td class="px-6 py-4 whitespace-nowrap">
                          {hasCases ? (
                            <a 
                              href="/test-plan" 
                              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                              </svg>
                              <span>{req.testCaseCount} Case(s)</span>
                            </a>
                          ) : (
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-50 text-neutral-400 border border-neutral-200">
                              No cases linked
                            </span>
                          )}
                        </td>
                        {/* Actions Column */}
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div class="flex items-center justify-end gap-2">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={`openGeneratorModal(${JSON.stringify(req)})`}
                                  class={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-soft hover:shadow-medium ${
                                    hasCases 
                                      ? 'bg-secondary-600 hover:bg-secondary-700' 
                                      : 'bg-primary-600 hover:bg-primary-700'
                                  }`}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: hasCases ? icons.refresh : icons.sparkles }} />
                                  <span>{hasCases ? 'Re-Generate' : 'Generate'}</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={`openEditModal(${JSON.stringify(req)})`}
                                  class="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                                  title="Edit requirement"
                                >
                                  <span dangerouslySetInnerHTML={{ __html: icons.edit }} />
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={`openDeleteModal(${JSON.stringify(req)})`}
                                  class="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                                  title="Delete requirement"
                                >
                                  <span dangerouslySetInnerHTML={{ __html: icons.delete }} />
                                </button>
                              </>
                            )}
                            {!canEdit && (
                              <span class="text-xs text-neutral-400 font-normal">Sign in to edit</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 1. CREATE MODAL */}
        <div 
          x-show="createOpen" 
          x-cloak 
          class="fixed inset-0 z-50 overflow-y-auto"
          style="display: none;"
        >
          <div class="fixed inset-0 modal-backdrop transition-opacity" x-on:click="createOpen = false"></div>
          <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative bg-white rounded-xl shadow-strong w-full max-w-md p-6 transform transition-all">
              <h3 class="text-lg font-bold text-neutral-900 mb-4">Create Requirement Story</h3>
              
              <div class="space-y-4">
                {/* Title */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Title <span class="text-danger-500">*</span></label>
                  <input
                    type="text"
                    x-model="title"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all"
                    placeholder="e.g. As a user, I can reset my password"
                  />
                </div>
                {/* Description */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Description (Acceptance Criteria)</label>
                  <textarea
                    x-model="description"
                    rows="4"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all resize-none"
                    placeholder="Describe acceptance criteria or technical details..."
                  ></textarea>
                </div>
                {/* Status */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Status</label>
                  <select
                    x-model="status"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Error Banner */}
                <div x-show="errorMessage" class="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-xs" style="display: none;">
                  <span x-text="errorMessage"></span>
                </div>

                {/* Footer Buttons */}
                <div class="flex justify-end gap-3 pt-4 border-t border-neutral-100 mt-6">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                    x-on:click="createOpen = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                    x-bind:disabled="!title.trim() || submitting"
                    x-on:click="createRequirement()"
                  >
                    <span x-show="!submitting">Create</span>
                    <span x-show="submitting">Creating...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. EDIT MODAL */}
        <div 
          x-show="editOpen" 
          x-cloak 
          class="fixed inset-0 z-50 overflow-y-auto"
          style="display: none;"
        >
          <div class="fixed inset-0 modal-backdrop transition-opacity" x-on:click="editOpen = false"></div>
          <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative bg-white rounded-xl shadow-strong w-full max-w-md p-6 transform transition-all">
              <h3 class="text-lg font-bold text-neutral-900 mb-4">Edit Story <span x-text="currentReqId" class="text-neutral-500 text-sm ml-1"></span></h3>
              
              <div class="space-y-4">
                {/* Title */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Title <span class="text-danger-500">*</span></label>
                  <input
                    type="text"
                    x-model="title"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all"
                  />
                </div>
                {/* Description */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Description (Acceptance Criteria)</label>
                  <textarea
                    x-model="description"
                    rows="4"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all resize-none"
                  ></textarea>
                </div>
                {/* Status */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1">Status</label>
                  <select
                    x-model="status"
                    class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Error Banner */}
                <div x-show="errorMessage" class="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-xs" style="display: none;">
                  <span x-text="errorMessage"></span>
                </div>

                {/* Footer Buttons */}
                <div class="flex justify-end gap-3 pt-4 border-t border-neutral-100 mt-6">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                    x-on:click="editOpen = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                    x-bind:disabled="!title.trim() || submitting"
                    x-on:click="saveRequirement()"
                  >
                    <span x-show="!submitting">Save Changes</span>
                    <span x-show="submitting">Saving...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. DELETE CONFIRMATION MODAL */}
        <div 
          x-show="deleteOpen" 
          x-cloak 
          class="fixed inset-0 z-50 overflow-y-auto"
          style="display: none;"
        >
          <div class="fixed inset-0 modal-backdrop transition-opacity" x-on:click="deleteOpen = false"></div>
          <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative bg-white rounded-xl shadow-strong w-full max-w-md p-6 transform transition-all">
              <h3 class="text-lg font-bold text-neutral-900 mb-2">Delete Story</h3>
              <p class="text-sm text-neutral-600 mb-6">
                Are you sure you want to delete requirement <strong x-text="currentReqId"></strong>? This will permanently remove the requirement mapping. 
                <span class="text-danger-600 block mt-1 font-medium">Warning: Any linked test cases will be detached or deleted accordingly.</span>
              </p>
              
              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                  x-on:click="deleteOpen = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-semibold text-white bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors disabled:opacity-50"
                  x-bind:disabled="submitting"
                  x-on:click="deleteRequirement()"
                >
                  <span x-show="!submitting">Delete permanently</span>
                  <span x-show="submitting">Deleting...</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. REAL-TIME PROGRESS LOADER MODAL (AI TEST CASE GENERATOR) */}
        <div 
          x-show="generatorOpen" 
          x-cloak 
          class="fixed inset-0 z-50 overflow-y-auto"
          style="display: none;"
        >
          <div class="fixed inset-0 modal-backdrop transition-opacity" x-on:click="if (errorMessage || phaseCreating === 'complete') generatorOpen = false;"></div>
          <div class="flex min-h-full items-center justify-center p-4">
            <div 
              class="relative bg-white rounded-xl shadow-strong w-full max-w-lg p-6 sm:p-8 transform transition-all"
              {...{"x-on:click.stop": ""}}
            >
              {/* Folder Selector View */}
              <div x-show="phaseReading === 'pending' && !errorMessage">
                <h3 class="text-lg font-bold text-neutral-900 mb-2">Configure Test Case Generation</h3>
                <p class="text-sm text-neutral-600 mb-6">
                  Generate comprehensive, AI-crafted test scenarios using Workers LLM for: <br />
                  <strong class="text-neutral-800" x-text="currentReqId + ' - ' + generationReqTitle"></strong>
                </p>
                
                <div class="space-y-4 mb-6">
                  <div>
                    <label class="block text-sm font-semibold text-neutral-700 mb-1.5">Target Test Suite/Folder (Optional)</label>
                    <select
                      x-model="selectedFolderId"
                      class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                    >
                      <option value="">Root Level (No Folder)</option>
                      {allFolders.map((folder: Folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                    <p class="text-xs text-neutral-500 mt-1">
                      Choose which folder generated test cases will be placed in.
                    </p>
                  </div>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                    x-on:click="generatorOpen = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all shadow-soft"
                    x-on:click="runAIGeneration()"
                  >
                    <span dangerouslySetInnerHTML={{ __html: icons.sparkles }} />
                    <span>Generate Scenarios</span>
                  </button>
                </div>
              </div>

              {/* Streaming Progress View */}
              <div x-show="phaseReading !== 'pending' && !errorMessage">
                <h3 class="text-lg font-bold text-neutral-900 mb-1">Generating Test Cases</h3>
                <p class="text-sm text-neutral-500 mb-6 truncate" x-text="generationReqTitle"></p>
                
                {/* Checklist Steps */}
                <div class="space-y-5">
                  {/* Step 1: Reading */}
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0">
                      <template x-if="phaseReading === 'active'">
                        <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.spinner }} />
                      </template>
                      <template x-if="phaseReading === 'complete'">
                        <span class="text-success-600" dangerouslySetInnerHTML={{ __html: icons.checkmark }} />
                      </template>
                      <template x-if="phaseReading === 'pending'">
                        <span class="text-neutral-300" dangerouslySetInnerHTML={{ __html: icons.pending }} />
                      </template>
                    </div>
                    <div class="flex-1">
                      <p class={`text-sm font-semibold ${phaseReading === 'active' ? 'text-neutral-900' : phaseReading === 'complete' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Reading User Stories
                      </p>
                      <p class="text-xs text-neutral-400" x-show="phaseReading === 'active'">Analyzing feature contexts and requirements...</p>
                    </div>
                  </div>

                  {/* Step 2: Scenarios */}
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0">
                      <template x-if="phaseScenarios === 'active'">
                        <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.spinner }} />
                      </template>
                      <template x-if="phaseScenarios === 'complete'">
                        <span class="text-success-600" dangerouslySetInnerHTML={{ __html: icons.checkmark }} />
                      </template>
                      <template x-if="phaseScenarios === 'pending'">
                        <span class="text-neutral-300" dangerouslySetInnerHTML={{ __html: icons.pending }} />
                      </template>
                    </div>
                    <div class="flex-1">
                      <p class={`text-sm font-semibold ${phaseScenarios === 'active' ? 'text-neutral-900' : phaseScenarios === 'complete' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Figuring out test scenarios
                      </p>
                      <p class="text-xs text-neutral-400" x-show="phaseScenarios === 'active'">Workers AI is planning testing vectors and edge cases...</p>
                    </div>
                  </div>

                  {/* Step 3: Creating */}
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0">
                      <template x-if="phaseCreating === 'active'">
                        <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.spinner }} />
                      </template>
                      <template x-if="phaseCreating === 'complete'">
                        <span class="text-success-600" dangerouslySetInnerHTML={{ __html: icons.checkmark }} />
                      </template>
                      <template x-if="phaseCreating === 'pending'">
                        <span class="text-neutral-300" dangerouslySetInnerHTML={{ __html: icons.pending }} />
                      </template>
                    </div>
                    <div class="flex-1">
                      <p class={`text-sm font-semibold ${phaseCreating === 'active' ? 'text-neutral-900' : phaseCreating === 'complete' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Creating Test Cases 
                        <span class="ml-1 text-xs text-primary-600 font-bold" x-show="phaseCreating === 'active'" x-text="'(' + creatingCurrent + '/' + creatingTotal + ')'"></span>
                      </p>
                      <p class="text-xs text-neutral-400" x-show="phaseCreating === 'active'">Deduplicating existing scenarios and inserting database test case entries...</p>
                      <p class="text-xs text-success-600 font-medium" x-show="phaseCreating === 'complete'">Import complete! Detached old records and updated sequential actions.</p>
                    </div>
                  </div>
                </div>
                
                {/* Visual loading bar */}
                <div class="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-8">
                  <div 
                    class="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full transition-all duration-300"
                    x-bind:style={`'width: ' + (phaseCreating === 'complete' ? 100 : phaseCreating === 'active' && creatingTotal > 0 ? (creatingCurrent / creatingTotal) * 100 : phaseScenarios === 'complete' ? 66 : phaseReading === 'complete' ? 33 : 10) + '%'`}
                  ></div>
                </div>
              </div>

              {/* Error State View */}
              <div x-show="errorMessage" style="display: none;">
                <div class="text-center py-4">
                  <div class="w-12 h-12 bg-danger-50 text-danger-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-danger-200">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                  </div>
                  <h3 class="text-base font-bold text-neutral-900 mb-2">Generation Failed</h3>
                  <p class="text-sm text-neutral-600 mb-6" x-text="errorMessage"></p>
                  
                  <div class="flex justify-center gap-3">
                    <button
                      type="button"
                      class="px-5 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                      x-on:click="generatorOpen = false"
                    >
                      Close Loader
                    </button>
                    <button
                      type="button"
                      class="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                      x-on:click="runAIGeneration()"
                    >
                      Retry Generation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

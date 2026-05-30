import type { Context } from 'hono';
import type { Bindings, Folder, Requirement } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { createDb } from '../../db';
import { requirements, folders, testCaseRequirements, testCases, testCaseSteps } from '../../db/schema';
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
      <script 
        id="requirements-data" 
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reqs).replace(/</g, '\\u003c') }}
      />
      <div 
        class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
        x-data={`{
          // Modals
          deleteOpen: false,
          generatorOpen: false,
          
          // Form Fields
          currentId: null,
          currentReqId: '',
          title: '',
          
          // AI Generator Specifics
          selectedFolderId: '',
          showCreateFolder: false,
          newFolderName: '',
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
          
          openDeleteModal(id) {
            const data = JSON.parse(document.getElementById('requirements-data').textContent);
            const req = data.find(r => r.id === id);
            if (!req) return;
            this.currentId = req.id;
            this.currentReqId = req.reqId;
            this.title = req.title;
            this.deleteOpen = true;
          },
          
          openGeneratorModal(id) {
            const data = JSON.parse(document.getElementById('requirements-data').textContent);
            const req = data.find(r => r.id === id);
            if (!req) return;
            this.currentId = req.id;
            this.currentReqId = req.reqId;
            this.generationReqTitle = req.title;
            this.selectedFolderId = '';
            this.showCreateFolder = false;
            this.newFolderName = '';
            this.phaseReading = 'pending';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            this.creatingCurrent = 0;
            this.creatingTotal = 0;
            this.errorMessage = '';
            this.generatorOpen = true;
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
            this.errorMessage = '';
            
            // If "Create new folder" is chosen, perform folder creation first
            if (this.showCreateFolder && this.newFolderName.trim()) {
              this.phaseReading = 'active'; // show early activity status
              try {
                const folderRes = await fetch('/api/folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: this.newFolderName.trim()
                  })
                });
                
                if (folderRes.ok) {
                  const createdFolder = await folderRes.json();
                  this.selectedFolderId = createdFolder.id.toString();
                } else {
                  const err = await folderRes.json().catch(() => ({}));
                  this.errorMessage = 'Failed to create folder: ' + (err.error || 'Unknown error');
                  this.phaseReading = 'pending';
                  return;
                }
              } catch (e) {
                this.errorMessage = 'Failed to create folder due to network error.';
                this.phaseReading = 'pending';
                return;
              }
            }
            
            this.phaseReading = 'active';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            
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
                const lines = buffer.split('\\\\n');
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
                      } else if (payload.status === 'complete' || payload.status === 'done') {
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
            <a
              href="/requirements/new"
              class="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all bg-primary-600 hover:bg-primary-700 text-white shadow-soft hover:shadow-medium px-4 py-2 text-sm"
            >
              <span dangerouslySetInnerHTML={{ __html: icons.plus }} />
              <span>New Story</span>
            </a>
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
                <a
                  href="/requirements/new"
                  class="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all bg-primary-600 hover:bg-primary-700 text-white shadow-soft hover:shadow-medium px-4 py-2 text-sm"
                >
                  <span dangerouslySetInnerHTML={{ __html: icons.plus }} />
                  <span>Add Your First Requirement</span>
                </a>
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
                          <a 
                            href={`/requirements/${req.id}`}
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
                          >
                            {req.reqId}
                          </a>
                        </td>
                        {/* Title Column */}
                        <td class="px-6 py-4">
                          <a 
                            href={`/requirements/${req.id}`} 
                            class="text-sm font-semibold text-neutral-900 hover:text-primary-600 transition-colors mb-0.5 block"
                          >
                            {req.title}
                          </a>
                          <div class="text-xs text-neutral-500 line-clamp-2 max-w-md">
                            {req.description || 'No description provided.'}
                          </div>
                        </td>
                        {/* Status Column */}
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
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
                                  x-on:click={`openGeneratorModal(${req.id})`}
                                  class={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-soft hover:shadow-medium ${
                                    hasCases 
                                      ? 'bg-secondary-600 hover:bg-secondary-700' 
                                      : 'bg-primary-600 hover:bg-primary-700'
                                  }`}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: hasCases ? icons.refresh : icons.sparkles }} />
                                  <span>{hasCases ? 'Re-Generate' : 'Generate'}</span>
                                </button>
                                
                                <a
                                  href={`/requirements/${req.id}`}
                                  class="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors inline-block"
                                  title="View & Edit story specs"
                                >
                                  <span dangerouslySetInnerHTML={{ __html: icons.edit }} />
                                </a>
                                
                                <button
                                  type="button"
                                  x-on:click={`openDeleteModal(${req.id})`}
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

        {/* DELETE CONFIRMATION MODAL */}
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
                <span class="text-danger-600 block mt-1 font-medium">Warning: Any linked test cases will be detached.</span>
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

        {/* REAL-TIME PROGRESS LOADER MODAL (AI TEST CASE GENERATOR) */}
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
                
                {/* Folder choice and dynamic folder creation */}
                <div class="space-y-4 mb-6">
                  <div x-show="!showCreateFolder">
                    <div class="flex justify-between items-center mb-1.5">
                      <label class="block text-sm font-semibold text-neutral-700">Target Test Suite/Folder (Optional)</label>
                      <button 
                        type="button" 
                        class="text-xs text-primary-650 hover:text-primary-750 font-bold transition-all"
                        x-on:click="showCreateFolder = true; selectedFolderId = ''; newFolderName = '';"
                      >
                        + Create New Folder
                      </button>
                    </div>
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
                  
                  <div x-show="showCreateFolder" style="display: none;">
                    <div class="flex justify-between items-center mb-1.5">
                      <label class="block text-sm font-semibold text-neutral-700">New Folder Name <span class="text-danger-500">*</span></label>
                      <button 
                        type="button" 
                        class="text-xs text-neutral-500 hover:text-neutral-705 font-bold transition-all"
                        x-on:click="showCreateFolder = false; newFolderName = '';"
                      >
                        Choose Existing Folder
                      </button>
                    </div>
                    <input
                      type="text"
                      x-model="newFolderName"
                      class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all"
                      placeholder="e.g. Authentication & Authorization"
                    />
                    <p class="text-xs text-neutral-500 mt-1">
                      A brand-new folder will be created in your Test Plan, and all generated test cases will be placed in it.
                    </p>
                  </div>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors border"
                    x-on:click="generatorOpen = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all shadow-soft"
                    x-bind:disabled="showCreateFolder && !newFolderName.trim()"
                    x-on:click="runAIGeneration()"
                  >
                    <span dangerouslySetInnerHTML={{ __html: icons.sparkles }} />
                    <span>Generate Scenarios</span>
                  </button>
                </div>
              </div>

              {/* Streaming Progress View */}
              <div x-show="phaseReading !== 'pending' && !errorMessage" style="display: none;">
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseReading === 'active' ? 'text-neutral-900' : phaseReading === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseScenarios === 'active' ? 'text-neutral-900' : phaseScenarios === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseCreating === 'active' ? 'text-neutral-900' : phaseCreating === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
                        Creating Test Cases 
                        <span class="ml-1 text-xs text-primary-600 font-bold" x-show="phaseCreating === 'active'" x-text="'(' + creatingCurrent + '/' + creatingTotal + ')'"></span>
                      </p>
                      <p class="text-xs text-neutral-400" x-show="phaseCreating === 'active'">Deduplicating existing scenarios and inserting database test case entries...</p>
                      <p class="text-xs text-success-600 font-medium" x-show="phaseCreating === 'complete'">Import complete! Updated sequential actions.</p>
                    </div>
                  </div>
                </div>
                
                {/* Visual loading bar */}
                <div class="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-8">
                  <div 
                    class="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full transition-all duration-300"
                    x-bind:style="'width: ' + (phaseCreating === 'complete' ? 100 : phaseCreating === 'active' && creatingTotal > 0 ? (creatingCurrent / creatingTotal) * 100 : phaseScenarios === 'complete' ? 66 : phaseReading === 'complete' ? 33 : 10) + '%'"
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
                  <p class="text-sm text-neutral-605 mb-6" x-text="errorMessage"></p>
                  
                  <div class="flex justify-center gap-3">
                    <button
                      type="button"
                      class="px-5 py-2 text-sm font-semibold text-neutral-700 bg-neutral-105 hover:bg-neutral-200 rounded-lg transition-colors border"
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

export async function requirementsNewPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/auth/signin');
  }
  
  return c.html(
    <Layout user={user} currentPath="/requirements" title="New User Story">
      <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div class="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <a href="/requirements" class="hover:text-primary-650 transition-colors">Requirements</a>
          <span>/</span>
          <span class="text-neutral-800 font-medium">New User Story</span>
        </div>

        {/* Header */}
        <div class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Create User Story</h1>
          <p class="text-sm text-neutral-600">Add a new user story or functional requirement to your repository.</p>
        </div>

        <Card>
          <div 
            x-data={`{
              title: '',
              description: '',
              status: 'Open',
              errorMessage: '',
              submitting: false,
              async submit() {
                if (!this.title.trim() || this.submitting) return;
                this.submitting = true;
                this.errorMessage = '';
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
                    const newStory = await res.json();
                    window.location.href = '/requirements/' + newStory.id;
                  } else {
                    const err = await res.json().catch(() => ({}));
                    this.errorMessage = err.error || 'Failed to create story';
                    this.submitting = false;
                  }
                } catch (e) {
                  this.errorMessage = 'Network connection error. Please try again.';
                  this.submitting = false;
                }
              }
            }`}
            class="space-y-6"
          >
            {/* Title */}
            <div>
              <label class="block text-sm font-semibold text-neutral-705 mb-1.5">
                Title <span class="text-danger-500">*</span>
              </label>
              <input
                type="text"
                x-model="title"
                class="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all"
                placeholder="As a user, I should be able to reset my password..."
              />
            </div>

            {/* Description / Acceptance Criteria */}
            <div>
              <label class="block text-sm font-semibold text-neutral-705 mb-1.5">
                Description (Acceptance Criteria)
              </label>
              <textarea
                x-model="description"
                rows={8}
                class="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all resize-y"
                placeholder="Describe acceptance criteria or technical details..."
              ></textarea>
            </div>

            {/* Status */}
            <div>
              <label class="block text-sm font-semibold text-neutral-705 mb-1.5">Status</label>
              <select
                x-model="status"
                class="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Implemented">Implemented</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Error Banner */}
            <div x-show="errorMessage" class="p-4 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm" style="display: none;">
              <span x-text="errorMessage"></span>
            </div>

            {/* Footer Buttons */}
            <div class="flex justify-end gap-3 pt-6 border-t border-neutral-100">
              <a
                href="/requirements"
                class="px-5 py-2.5 text-sm font-medium text-neutral-750 hover:bg-neutral-105 rounded-lg transition-colors border"
              >
                Cancel
              </a>
              <button
                type="button"
                class="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-soft"
                x-bind:disabled="!title.trim() || submitting"
                x-on:click="submit()"
              >
                <span x-show="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span x-text="submitting ? 'Creating...' : 'Create Story'"></span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export async function requirementsDetailPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const [requirement] = await db
    .select()
    .from(requirements)
    .where(eq(requirements.id, id))
    .limit(1);
    
  if (!requirement) {
    return c.html(
      <Layout user={user} currentPath="/requirements" title="User Story Not Found">
        <div class="p-8 max-w-4xl mx-auto">
          <Card>
            <div class="text-center py-12">
              <h3 class="text-lg font-semibold text-neutral-900 mb-2">User Story Not Found</h3>
              <p class="text-neutral-600 mb-6">The requirement story you are looking for does not exist.</p>
              <a
                href="/requirements"
                class="inline-flex items-center justify-center font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-white shadow-soft px-4 py-2 text-sm"
              >
                Back to Requirements
              </a>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }
  
  // Fetch linked test cases
  const linkedCases = await db
    .select({
      id: testCases.id,
      title: testCases.title,
      description: testCases.description,
      priority: testCases.priority,
      status: testCases.status,
      isAutomated: testCases.isAutomated,
    })
    .from(testCaseRequirements)
    .innerJoin(testCases, eq(testCaseRequirements.testCaseId, testCases.id))
    .where(eq(testCaseRequirements.requirementId, id));
    
  const linkedCasesWithSteps = await Promise.all(
    linkedCases.map(async (tc) => {
      const steps = await db
        .select()
        .from(testCaseSteps)
        .where(eq(testCaseSteps.testCaseId, tc.id))
        .orderBy(testCaseSteps.stepNumber);
      return { ...tc, steps };
    })
  );
  
  const allFolders = await db.select().from(folders);
  const canEdit = !!user;
  const hasCases = linkedCasesWithSteps.length > 0;
  
  const reqData = {
    title: requirement.title,
    description: requirement.description || '',
    status: requirement.status || 'Open'
  };
  
  return c.html(
    <Layout user={user} currentPath="/requirements" title={`${requirement.reqId} - ${requirement.title}`}>
      <script 
        id="requirement-data" 
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reqData).replace(/</g, '\\u003c') }}
      />
      <div 
        class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
        x-data={`{
          isEditing: false,
          
          // Form fields
          title: '',
          description: '',
          status: 'Open',
          errorMessage: '',
          submitting: false,
          
          init() {
            const data = JSON.parse(document.getElementById('requirement-data').textContent);
            this.title = data.title;
            this.description = data.description;
            this.status = data.status;
          },
          
          cancelEdit() {
            this.isEditing = false;
            const data = JSON.parse(document.getElementById('requirement-data').textContent);
            this.title = data.title;
            this.description = data.description;
            this.status = data.status;
            this.errorMessage = '';
          },
          
          // Modals
          deleteOpen: false,
          generatorOpen: false,
          
          // AI Generator Specifics
          selectedFolderId: '',
          showCreateFolder: false,
          newFolderName: '',
          
          // Real-time progress loader state
          phaseReading: 'pending',
          phaseScenarios: 'pending',
          phaseCreating: 'pending',
          creatingCurrent: 0,
          creatingTotal: 0,
          
          openGeneratorModal() {
            this.selectedFolderId = '';
            this.showCreateFolder = false;
            this.newFolderName = '';
            this.phaseReading = 'pending';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            this.creatingCurrent = 0;
            this.creatingTotal = 0;
            this.errorMessage = '';
            this.generatorOpen = true;
          },
          
          async saveRequirement() {
            if (!this.title.trim() || this.submitting) return;
            this.submitting = true;
            this.errorMessage = '';
            try {
              const res = await fetch('/api/requirements/${id}', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: this.title.trim(),
                  description: this.description.trim() || null,
                  status: this.status
                })
              });
              if (res.ok) {
                window.showToast?.('User story saved successfully!', 'success');
                setTimeout(() => window.location.reload(), 800);
              } else {
                const err = await res.json();
                this.errorMessage = err.error || 'Failed to update requirement';
                this.submitting = false;
              }
            } catch (e) {
              this.errorMessage = 'Connection failure.';
              this.submitting = false;
            }
          },
          
          async deleteRequirement() {
            if (this.submitting) return;
            this.submitting = true;
            try {
              const res = await fetch('/api/requirements/${id}', {
                method: 'DELETE'
              });
              if (res.ok) {
                window.location.href = '/requirements';
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
            this.errorMessage = '';
            
            // Handle folder creation first if chosen
            if (this.showCreateFolder && this.newFolderName.trim()) {
              this.phaseReading = 'active';
              try {
                const folderRes = await fetch('/api/folders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: this.newFolderName.trim() })
                });
                if (folderRes.ok) {
                  const folder = await folderRes.json();
                  this.selectedFolderId = folder.id.toString();
                } else {
                  const err = await folderRes.json().catch(() => ({}));
                  this.errorMessage = 'Failed to create folder: ' + (err.error || 'Unknown error');
                  this.phaseReading = 'pending';
                  return;
                }
              } catch (e) {
                this.errorMessage = 'Failed to create folder due to network error.';
                this.phaseReading = 'pending';
                return;
              }
            }

            this.phaseReading = 'active';
            this.phaseScenarios = 'pending';
            this.phaseCreating = 'pending';
            
            try {
              const res = await fetch('/api/requirements/${id}/generate-test-cases', {
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
                const lines = buffer.split('\\\\n');
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
                      } else if (payload.status === 'complete' || payload.status === 'done') {
                        this.phaseReading = 'complete';
                        this.phaseScenarios = 'complete';
                        this.phaseCreating = 'complete';
                        
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
        {/* Breadcrumb */}
        <div class="flex items-center gap-2 text-sm text-neutral-505 mb-6">
          <a href="/requirements" class="hover:text-primary-650 transition-colors">Requirements</a>
          <span>/</span>
          <span class="text-neutral-800 font-semibold">{requirement.reqId}</span>
        </div>

        {/* Top Header Section */}
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-6 border-b border-neutral-200 animate-fade-in">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-primary-100 text-primary-850 border border-primary-200 font-mono">
                {requirement.reqId}
              </span>
              <span class={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
                requirement.status === 'Implemented' ? 'bg-success-50 text-success-700 border-success-200' :
                requirement.status === 'In Progress' ? 'bg-primary-50 text-primary-700 border-primary-200' :
                requirement.status === 'Closed' ? 'bg-neutral-100 text-neutral-600 border-neutral-250' :
                'bg-warning-50 text-warning-700 border-warning-200'
              }`}>
                {requirement.status || 'Open'}
              </span>
            </div>
            
            {/* View Title */}
            <h1 x-show="!isEditing" class="text-2xl sm:text-3xl font-extrabold text-neutral-900 leading-tight" x-text="title">
              {requirement.title}
            </h1>
            
            {/* Edit Title Indicator */}
            <h1 x-show="isEditing" style="display: none;" class="text-2xl sm:text-3xl font-extrabold text-neutral-900 leading-tight">
              Editing Story <span class="text-neutral-500 font-normal">{requirement.reqId}</span>
            </h1>
          </div>
          
          <div class="flex flex-wrap items-center gap-2.5">
            {/* Back Button (View Mode only) */}
            <a
              x-show="!isEditing"
              href="/requirements"
              class="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 transition-all shadow-soft"
            >
              Back to Stories
            </a>
            
            {/* Cancel Button (Edit Mode only) */}
            <button
              type="button"
              x-show="isEditing"
              style="display: none;"
              class="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 transition-all shadow-soft"
              x-on:click="cancelEdit()"
            >
              Cancel
            </button>
            
            {canEdit && (
              <>
                {/* Delete Button (View Mode only) */}
                <button
                  type="button"
                  x-show="!isEditing"
                  class="px-4 py-2 border border-danger-300 text-danger-700 hover:bg-danger-50 rounded-lg text-sm font-semibold transition-all"
                  x-on:click="deleteOpen = true"
                >
                  Delete Story
                </button>
                
                {/* Edit Button (View Mode only) */}
                <button
                  type="button"
                  x-show="!isEditing"
                  class="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-all shadow-soft hover:shadow-medium"
                  x-on:click="isEditing = true"
                >
                  Edit Story
                </button>
                
                {/* Save Button (Edit Mode only) */}
                <button
                  type="button"
                  x-show="isEditing"
                  style="display: none;"
                  class="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-all shadow-soft hover:shadow-medium flex items-center gap-2 disabled:opacity-50"
                  x-bind:disabled="!title.trim() || submitting"
                  x-on:click="saveRequirement()"
                >
                  <span x-show="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span x-text="submitting ? 'Saving...' : 'Save Changes'"></span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dual Column Layout */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Spacious details / Edit Form */}
          <div class="lg:col-span-7 space-y-6">
            <Card>
              <div class="space-y-6">
                <h2 class="text-lg font-bold text-neutral-900 pb-3 border-b border-neutral-100 flex items-center gap-2">
                  <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  Story Specifications
                </h2>
                
                {/* Title Input */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1.5">Title <span class="text-danger-550" x-show="isEditing">*</span></label>
                  
                  {/* View Mode */}
                  <div x-show="!isEditing" class="text-neutral-900 font-semibold text-sm py-2.5 px-4 bg-neutral-50 rounded-lg border border-neutral-200 leading-relaxed" x-text="title"></div>
                  
                  {/* Edit Mode */}
                  <input
                    x-show="isEditing"
                    style="display: none;"
                    type="text"
                    x-model="title"
                    class="w-full px-4 py-2.5 border border-neutral-350 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all font-semibold"
                  />
                </div>

                {/* Status Dropdown */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1.5">Status</label>
                  
                  {/* View Mode */}
                  <div x-show="!isEditing" class="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg w-full">
                    <span class="w-2 h-2 rounded-full" x-bind:class="status === 'Implemented' ? 'bg-success-500' : status === 'In Progress' ? 'bg-primary-500' : status === 'Closed' ? 'bg-neutral-400' : 'bg-warning-500'"></span>
                    <span class="text-sm font-semibold text-neutral-800" x-text="status"></span>
                  </div>
                  
                  {/* Edit Mode */}
                  <select
                    x-show="isEditing"
                    style="display: none;"
                    x-model="status"
                    class="w-full px-4 py-2.5 border border-neutral-350 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white font-semibold"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Description (Acceptance Criteria) - HUGE TEXT AREA */}
                <div>
                  <label class="block text-sm font-semibold text-neutral-700 mb-1.5">Description (Acceptance Criteria)</label>
                  
                  {/* View Mode */}
                  <div 
                    x-show="!isEditing" 
                    class="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-normal leading-relaxed text-neutral-800 whitespace-pre-wrap min-h-[350px]" 
                    x-text="description || 'No acceptance criteria or description provided.'"
                  ></div>
                  
                  {/* Edit Mode */}
                  <textarea
                    x-show="isEditing"
                    style="display: none;"
                    x-model="description"
                    rows={14}
                    class="w-full px-4 py-3 border border-neutral-350 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all resize-y font-normal leading-relaxed text-neutral-800"
                    placeholder="Enter detailed acceptance criteria, story constraints, personas, etc..."
                  ></textarea>
                </div>

                {/* Error Banner */}
                <div x-show="errorMessage" class="p-4 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm" style="display: none;">
                  <span x-text="errorMessage"></span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: QA Coverage / Linked Test Cases */}
          <div class="lg:col-span-5 space-y-6">
            <Card>
              <div class="space-y-6">
                <div class="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <h2 class="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                    </svg>
                    QA Test Coverage
                  </h2>
                  {canEdit && (
                    <button
                      type="button"
                      x-on:click="openGeneratorModal()"
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-all"
                    >
                      <span dangerouslySetInnerHTML={{ __html: hasCases ? icons.refresh : icons.sparkles }} />
                      <span>{hasCases ? 'Re-Generate' : 'Generate'}</span>
                    </button>
                  )}
                </div>

                {!hasCases ? (
                  <div class="text-center py-10 px-4">
                    <div class="mx-auto w-fit mb-3 text-neutral-400">
                      <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                    </div>
                    <h3 class="text-sm font-semibold text-neutral-800 mb-1">No test cases linked</h3>
                    <p class="text-xs text-neutral-500 mb-5 max-w-xs mx-auto">
                      There are no test cases mapped to this user story. Use AI to generate them instantly.
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        x-on:click="openGeneratorModal()"
                        class="inline-flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg px-4 py-2 text-sm shadow-soft"
                      >
                        <span dangerouslySetInnerHTML={{ __html: icons.sparkles }} />
                        <span>Generate with Workers AI</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div class="space-y-4">
                    <p class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Linked Test Cases ({linkedCasesWithSteps.length})
                    </p>
                    
                    <div class="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto pr-1">
                      {linkedCasesWithSteps.map((tc) => {
                        const tcId = `TC-${String(tc.id).padStart(3, '0')}`;
                        return (
                          <div 
                            key={tc.id} 
                            class="py-3 first:pt-0 last:pb-0"
                            x-data="{ expanded: false }"
                          >
                            <div class="flex items-start justify-between gap-3">
                              <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                  <span class="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 font-mono">
                                    {tcId}
                                  </span>
                                  <span class={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    tc.priority === 'High' ? 'bg-danger-50 text-danger-700 border border-danger-100' :
                                    tc.priority === 'Low' ? 'bg-neutral-100 text-neutral-705 border border-neutral-250' :
                                    'bg-warning-50 text-warning-700 border border-warning-100'
                                  }`}>
                                    {tc.priority || 'Medium'}
                                  </span>
                                </div>
                                <h4 class="text-sm font-semibold text-neutral-800 truncate">
                                  {tc.title}
                                </h4>
                                {tc.description && (
                                  <p class="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                                    {tc.description}
                                  </p>
                                )}
                              </div>
                              <div class="flex items-center gap-1">
                                <button
                                  type="button"
                                  x-on:click="expanded = !expanded"
                                  class="p-1 text-neutral-450 hover:text-neutral-700 rounded transition-colors"
                                  title="View Steps"
                                >
                                  <svg 
                                    class="w-4 h-4 transition-transform duration-200"
                                    x-bind:class="expanded ? 'rotate-180' : ''"
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
                                  </svg>
                                </button>
                                <a 
                                  href={`/test-case/${tc.id}`}
                                  class="p-1 text-neutral-450 hover:text-primary-600 rounded transition-colors"
                                  title="Open details"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                  </svg>
                                </a>
                              </div>
                            </div>
                            
                            {/* Expandable Test Steps Panel */}
                            <div 
                              x-show="expanded" 
                              x-collapse 
                              style="display: none;" 
                              class="mt-3 bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs space-y-2.5 animate-fade-in"
                            >
                              <p class="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Test Steps ({tc.steps.length})</p>
                              {tc.steps.length === 0 ? (
                                <p class="text-neutral-450 italic">No steps defined for this test case.</p>
                              ) : (
                                <ol class="space-y-2 list-decimal list-inside pl-1 text-neutral-700">
                                  {tc.steps.map((step) => (
                                    <li key={step.id} class="leading-relaxed border-b border-neutral-100 last:border-0 pb-1.5 last:pb-0">
                                      <strong class="text-neutral-800">Action:</strong> {step.action}
                                      {step.expectedResult && (
                                        <div class="text-neutral-500 pl-3 mt-0.5">
                                          <strong class="text-neutral-600">Expected:</strong> {step.expectedResult}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* DELETE CONFIRMATION MODAL */}
        <div 
          x-show="deleteOpen" 
          x-cloak 
          class="fixed inset-0 z-50 overflow-y-auto"
          style="display: none;"
        >
          <div class="fixed inset-0 modal-backdrop transition-opacity" x-on:click="deleteOpen = false"></div>
          <div class="flex min-h-full items-center justify-center p-4">
            <div class="relative bg-white rounded-xl shadow-strong w-full max-w-md p-6 transform transition-all">
              <h3 class="text-lg font-bold text-neutral-900 mb-2">Delete User Story</h3>
              <p class="text-sm text-neutral-605 mb-6">
                Are you sure you want to delete <strong class="text-neutral-800">{requirement.reqId}</strong>? This will permanently delete this story.
                <span class="text-danger-600 block mt-1 font-medium">Warning: Linked test cases will be decoupled.</span>
              </p>
              
              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors border"
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
                  <span x-show="!submitting">Delete Permanently</span>
                  <span x-show="submitting">Deleting...</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME PROGRESS LOADER MODAL (AI TEST CASE GENERATOR) */}
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
                  <strong class="text-neutral-800">{requirement.reqId} - {requirement.title}</strong>
                </p>
                
                <div class="space-y-4 mb-6">
                  <div x-show="!showCreateFolder">
                    <div class="flex justify-between items-center mb-1.5">
                      <label class="block text-sm font-semibold text-neutral-700">Target Test Suite/Folder (Optional)</label>
                      <button 
                        type="button" 
                        class="text-xs text-primary-650 hover:text-primary-750 font-bold transition-all"
                        x-on:click="showCreateFolder = true; selectedFolderId = ''; newFolderName = '';"
                      >
                        + Create New Folder
                      </button>
                    </div>
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
                  
                  <div x-show="showCreateFolder" style="display: none;">
                    <div class="flex justify-between items-center mb-1.5">
                      <label class="block text-sm font-semibold text-neutral-700">New Folder Name <span class="text-danger-500">*</span></label>
                      <button 
                        type="button" 
                        class="text-xs text-neutral-505 hover:text-neutral-700 font-bold transition-all"
                        x-on:click="showCreateFolder = false; newFolderName = '';"
                      >
                        Choose Existing Folder
                      </button>
                    </div>
                    <input
                      type="text"
                      x-model="newFolderName"
                      class="w-full px-3.5 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-all"
                      placeholder="e.g. Authentication & Authorization"
                    />
                    <p class="text-xs text-neutral-500 mt-1">
                      A brand-new folder will be created in your Test Plan, and all generated test cases will be placed in it.
                    </p>
                  </div>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-neutral-750 hover:bg-neutral-105 rounded-lg transition-colors border"
                    x-on:click="generatorOpen = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all shadow-soft"
                    x-bind:disabled="showCreateFolder && !newFolderName.trim()"
                    x-on:click="runAIGeneration()"
                  >
                    <span dangerouslySetInnerHTML={{ __html: icons.sparkles }} />
                    <span>Generate Scenarios</span>
                  </button>
                </div>
              </div>

              {/* Streaming Progress View */}
              <div x-show="phaseReading !== 'pending' && !errorMessage" style="display: none;">
                <h3 class="text-lg font-bold text-neutral-900 mb-1">Generating Test Cases</h3>
                <p class="text-sm text-neutral-500 mb-6 truncate">{requirement.title}</p>
                
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseReading === 'active' ? 'text-neutral-900' : phaseReading === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseScenarios === 'active' ? 'text-neutral-900' : phaseScenarios === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
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
                      <p 
                        class="text-sm font-semibold"
                        x-bind:class="phaseCreating === 'active' ? 'text-neutral-900' : phaseCreating === 'complete' ? 'text-neutral-500' : 'text-neutral-400'"
                      >
                        Creating Test Cases 
                        <span class="ml-1 text-xs text-primary-600 font-bold" x-show="phaseCreating === 'active'" x-text="'(' + creatingCurrent + '/' + creatingTotal + ')'"></span>
                      </p>
                      <p class="text-xs text-neutral-400" x-show="phaseCreating === 'active'">Deduplicating existing scenarios and inserting database test case entries...</p>
                      <p class="text-xs text-success-600 font-medium" x-show="phaseCreating === 'complete'">Import complete! Updated sequential actions.</p>
                    </div>
                  </div>
                </div>
                
                {/* Visual loading bar */}
                <div class="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-8">
                  <div 
                    class="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full transition-all duration-300"
                    x-bind:style="'width: ' + (phaseCreating === 'complete' ? 100 : phaseCreating === 'active' && creatingTotal > 0 ? (creatingCurrent / creatingTotal) * 100 : phaseScenarios === 'complete' ? 66 : phaseReading === 'complete' ? 33 : 10) + '%'"
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
                  <p class="text-sm text-neutral-605 mb-6" x-text="errorMessage"></p>
                  
                  <div class="flex justify-center gap-3">
                    <button
                      type="button"
                      class="px-5 py-2 text-sm font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border"
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

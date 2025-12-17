import type { Context } from 'hono';
import type { Bindings, Folder } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { FolderTree } from '../../components/FolderTree';
import { TestCaseCard } from '../../components/TestCaseCard';
import { TestCaseForm } from '../../components/TestCaseForm';
import { Badge } from '../../components/Badge';
import { StatusBadge } from '../../components/StatusBadge';
import { createDb } from '../../db';
import { folders, testCases, testCaseSteps, testCaseTags, tags, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateTestCaseId, formatDate, PRIORITY_COLORS } from '../../lib/utils';

const icons = {
  plus: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`,
  download: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
  upload: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>`,
  folder: `<svg class="w-16 h-16 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>`,
};

export async function testPlanPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const folderId = c.req.query('folderId');
  const selectedFolderId = folderId ? parseInt(folderId) : null;
  
  // Get all folders
  const allFolders = await db.select().from(folders);
  
  // Get test cases (optionally filtered by folder)
  let query = db
    .select({
      testCase: testCases,
      author: users,
    })
    .from(testCases)
    .leftJoin(users, eq(testCases.authorId, users.id));
  
  // If folder is selected, get all descendant folder IDs and filter
  let testCaseResults;
  if (selectedFolderId !== null) {
    // Get all descendant folder IDs
    const getDescendantIds = (id: number): number[] => {
      const descendants = [id];
      const children = allFolders.filter((f: Folder) => f.parentId === id);
      for (const child of children) {
        descendants.push(...getDescendantIds(child.id));
      }
      return descendants;
    };
    const folderIds = getDescendantIds(selectedFolderId);
    
    // Filter test cases by folder IDs
    const allTestCases = await query;
    testCaseResults = allTestCases.filter(({ testCase }) => 
      testCase.folderId !== null && folderIds.includes(testCase.folderId)
    );
  } else {
    testCaseResults = await query;
  }
  
  // Get steps and tags for each test case
  const testCasesWithDetails = await Promise.all(
    testCaseResults.map(async ({ testCase, author }) => {
      const steps = await db
        .select()
        .from(testCaseSteps)
        .where(eq(testCaseSteps.testCaseId, testCase.id))
        .orderBy(testCaseSteps.stepNumber);
      
      const caseTags = await db
        .select({ tag: tags })
        .from(testCaseTags)
        .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
        .where(eq(testCaseTags.testCaseId, testCase.id));
      
      return {
        ...testCase,
        steps,
        tags: caseTags.map(ct => ct.tag).filter(Boolean),
        author: author ? { id: author.id, fullName: author.fullName, email: author.email } : null,
      };
    })
  );
  
  const canEdit = !!user;
  
  return c.html(
    <Layout user={user} currentPath="/test-plan" title="Test Plan">
      <div class="flex h-full">
        {/* Sidebar - Folder Tree */}
        <div class="w-80 bg-white border-r border-neutral-200 p-4 overflow-y-auto scrollbar-thin">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-neutral-900 mb-2">Folders</h2>
            <p class="text-sm text-neutral-600">Organize your test cases</p>
          </div>
          
          <FolderTree
            folders={allFolders}
            selectedFolderId={selectedFolderId}
            canEdit={canEdit}
          />
        </div>

        {/* Main Content - Test Cases */}
        <div class="flex-1 overflow-y-auto p-8">
          <div class="max-w-7xl mx-auto">
            {/* Header */}
            <div class="flex items-center justify-between mb-6">
              <div>
                <h1 class="text-3xl font-bold text-neutral-900 mb-2">Test Plan</h1>
                <p class="text-neutral-600">
                  {selectedFolderId 
                    ? `${testCasesWithDetails.length} test case(s) in this folder`
                    : `${testCasesWithDetails.length} total test case(s)`
                  }
                </p>
              </div>
              
              <div class="flex gap-3">
                <Button
                  variant="ghost"
                  icon={icons.download}
                  href={selectedFolderId ? `/api/test-cases/export?folderId=${selectedFolderId}` : '/api/test-cases/export'}
                >
                  Export CSV
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      icon={icons.upload}
                      href="/test-plan/import"
                    >
                      Import CSV
                    </Button>
                    <Button
                      variant="primary"
                      icon={icons.plus}
                      href={`/test-case/new${selectedFolderId ? `?folderId=${selectedFolderId}` : ''}`}
                    >
                      New Test Case
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Test Cases Grid */}
            <div id="test-cases-list">
              {testCasesWithDetails.length === 0 ? (
                <Card>
                  <div class="text-center py-12">
                    <span dangerouslySetInnerHTML={{ __html: icons.folder }} class="mx-auto mb-4" />
                    <h3 class="text-lg font-semibold text-neutral-900 mb-2">
                      No test cases yet
                    </h3>
                    <p class="text-neutral-600 mb-6">
                      {canEdit
                        ? 'Create your first test case to get started'
                        : 'Sign in to create test cases'
                      }
                    </p>
                    {canEdit && (
                      <Button
                        variant="primary"
                        icon={icons.plus}
                        href="/test-case/new"
                      >
                        Create Test Case
                      </Button>
                    )}
                  </div>
                </Card>
              ) : (
                <div class="grid gap-4">
                  {testCasesWithDetails.map((testCase) => (
                    <TestCaseCard
                      key={testCase.id}
                      testCase={testCase}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Modal */}
      <div 
        x-data={`{
          open: false,
          folderId: null,
          parentId: null,
          folderName: '',
          isEdit: false,
          submitting: false,
          init() {
            window.addEventListener('open-folder-modal', (e) => {
              this.folderId = e.detail.id || null;
              this.parentId = e.detail.parentId;
              this.folderName = e.detail.name || '';
              this.isEdit = e.detail.isEdit || false;
              this.open = true;
              this.$nextTick(() => {
                this.$el.querySelector('input')?.focus();
              });
            });
          },
          async save() {
            if (!this.folderName.trim() || this.submitting) return;
            this.submitting = true;
            try {
              const url = this.isEdit ? '/api/folders/' + this.folderId : '/api/folders';
              const method = this.isEdit ? 'PUT' : 'POST';
              const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  name: this.folderName.trim(),
                  parentId: this.parentId
                })
              });
              if (response.ok) {
                window.location.reload();
              } else {
                const error = await response.json();
                alert('Error: ' + (error.error || 'Failed to save folder'));
                this.submitting = false;
              }
            } catch (e) {
              alert('Error saving folder');
              this.submitting = false;
            }
          }
        }`}
        x-show="open"
        x-cloak
        class="fixed inset-0 z-50 overflow-y-auto"
        style="display: none;"
      >
        <div class="fixed inset-0 bg-black/50" x-on:click="open = false"></div>
        <div class="flex min-h-full items-center justify-center p-4">
          <div 
            class="relative bg-white rounded-xl shadow-strong w-full max-w-md p-6"
            {...{"x-on:click.stop": ""}}
          >
            <h3 class="text-lg font-semibold text-neutral-900 mb-4" x-text="isEdit ? 'Edit Folder' : 'New Folder'">New Folder</h3>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-1">Folder Name</label>
                <input
                  type="text"
                  x-model="folderName"
                  class="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter folder name"
                  {...{"x-on:keydown.enter": "save()"}}
                />
              </div>
              
              <div class="flex justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                  x-on:click="open = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                  x-bind:disabled="!folderName.trim() || submitting"
                  x-on:click="save()"
                >
                  <span x-show="!submitting" x-text="isEdit ? 'Save' : 'Create'">Create</span>
                  <span x-show="submitting">Saving...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function testCaseViewPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const [result] = await db
    .select({
      testCase: testCases,
      author: users,
      folder: folders,
    })
    .from(testCases)
    .leftJoin(users, eq(testCases.authorId, users.id))
    .leftJoin(folders, eq(testCases.folderId, folders.id))
    .where(eq(testCases.id, id))
    .limit(1);
  
  if (!result) {
    return c.html(
      <Layout user={user} currentPath="/test-plan" title="Test Case Not Found">
        <div class="p-8 max-w-4xl mx-auto">
          <Card>
            <div class="text-center py-12">
              <h3 class="text-lg font-semibold text-neutral-900 mb-2">Test Case Not Found</h3>
              <p class="text-neutral-600 mb-6">The test case you're looking for doesn't exist.</p>
              <Button variant="primary" href="/test-plan">Back to Test Plan</Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }
  
  const steps = await db
    .select()
    .from(testCaseSteps)
    .where(eq(testCaseSteps.testCaseId, id))
    .orderBy(testCaseSteps.stepNumber);
  
  const caseTags = await db
    .select({ tag: tags })
    .from(testCaseTags)
    .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
    .where(eq(testCaseTags.testCaseId, id));
  
  const { testCase, author, folder } = result;
  const canEdit = !!user;
  const priorityVariant = PRIORITY_COLORS[testCase.priority || 'Medium'] as any || 'neutral';
  
  return c.html(
    <Layout user={user} currentPath="/test-plan" title={testCase.title}>
      <div class="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div class="mb-6">
          <div class="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <a href="/test-plan" class="hover:text-primary-600">Test Plan</a>
            <span>/</span>
            {folder && (
              <>
                <a href={`/test-plan?folderId=${folder.id}`} class="hover:text-primary-600">{folder.name}</a>
                <span>/</span>
              </>
            )}
            <span class="text-primary-600">{generateTestCaseId(testCase.id)}</span>
          </div>
          
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-3xl font-bold text-neutral-900 mb-2">{testCase.title}</h1>
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant={priorityVariant}>{testCase.priority || 'Medium'}</Badge>
                <StatusBadge status={testCase.status || 'Draft'} type="case" />
                {testCase.isAutomated && <Badge variant="info">Automated</Badge>}
                {caseTags.map(ct => ct.tag && (
                  <Badge key={ct.tag.id} variant="neutral">{ct.tag.name}</Badge>
                ))}
              </div>
            </div>
            
            {canEdit && (
              <div class="flex gap-2">
                <Button variant="ghost" href={`/test-case/${id}/edit`}>Edit</Button>
                <Button 
                  variant="danger" 
                  onClick={`if(confirm('Delete this test case?')) { htmx.ajax('DELETE', '/api/test-cases/${id}').then(() => window.location.href = '/test-plan'); }`}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <Card>
          <div class="space-y-6">
            {/* Description */}
            <div>
              <h4 class="text-sm font-medium text-neutral-700 mb-1">Description</h4>
              <p class="text-neutral-900">{testCase.description || 'No description'}</p>
            </div>
            
            {/* Pre-conditions */}
            {testCase.preConditions && (
              <div>
                <h4 class="text-sm font-medium text-neutral-700 mb-1">Pre-Conditions</h4>
                <p class="text-neutral-900">{testCase.preConditions}</p>
              </div>
            )}
            
            {/* Test Steps */}
            <div>
              <h4 class="text-sm font-medium text-neutral-700 mb-3">Test Steps</h4>
              {steps.length > 0 ? (
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse">
                    <thead>
                      <tr class="bg-neutral-100 border-b border-neutral-200">
                        <th class="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider w-16">
                          Step #
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Step Action
                        </th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Expected Results
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-neutral-200">
                      {steps.map((step, index) => (
                        <tr key={step.id} class="hover:bg-neutral-50">
                          <td class="px-4 py-3 text-center">
                            <span class="inline-flex items-center justify-center w-7 h-7 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                              {step.stepNumber}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-sm text-neutral-900">
                            {step.action}
                          </td>
                          <td class="px-4 py-3 text-sm text-neutral-600">
                            {step.expectedResult || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p class="text-neutral-500">No steps defined</p>
              )}
            </div>
            
            {/* Metadata */}
            <div class="pt-4 border-t border-neutral-200 text-sm text-neutral-500">
              Created {formatDate(testCase.createdAt)}
              {author && ` by ${author.fullName || author.email}`}
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export async function testCaseEditPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/auth/signin');
  }
  
  const db = createDb(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const [result] = await db
    .select({ testCase: testCases })
    .from(testCases)
    .where(eq(testCases.id, id))
    .limit(1);
  
  if (!result) {
    return c.redirect('/test-plan');
  }
  
  const allFolders = await db.select().from(folders);
  const allTags = await db.select().from(tags);
  
  const steps = await db
    .select()
    .from(testCaseSteps)
    .where(eq(testCaseSteps.testCaseId, id))
    .orderBy(testCaseSteps.stepNumber);
  
  const caseTags = await db
    .select({ tag: tags })
    .from(testCaseTags)
    .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
    .where(eq(testCaseTags.testCaseId, id));
  
  const testCase = {
    ...result.testCase,
    steps: steps.map(s => ({ action: s.action, expectedResult: s.expectedResult })),
    tags: caseTags.map(ct => ct.tag).filter(Boolean) as { name: string }[],
  };
  
  return c.html(
    <Layout user={user} currentPath="/test-plan" title={`Edit ${testCase.title}`}>
      <div class="p-8 max-w-4xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-neutral-900 mb-2">Edit Test Case</h1>
          <p class="text-neutral-600">{generateTestCaseId(testCase.id)} - {testCase.title}</p>
        </div>
        
        <Card>
          <TestCaseForm
            testCase={testCase}
            folders={allFolders}
            availableTags={allTags.map(t => t.name)}
            isEdit={true}
          />
        </Card>
      </div>
    </Layout>
  );
}

export async function testCaseNewPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/auth/signin');
  }
  
  const db = createDb(c.env.DB);
  const folderId = c.req.query('folderId');
  
  const allFolders = await db.select().from(folders);
  const allTags = await db.select().from(tags);
  
  const initialData = folderId ? { folderId: parseInt(folderId) } : undefined;
  
  return c.html(
    <Layout user={user} currentPath="/test-plan" title="New Test Case">
      <div class="p-8 max-w-4xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-neutral-900 mb-2">Create Test Case</h1>
          <p class="text-neutral-600">Add a new test case to your repository</p>
        </div>
        
        <Card>
          <TestCaseForm
            testCase={initialData}
            folders={allFolders}
            availableTags={allTags.map(t => t.name)}
            isEdit={false}
          />
        </Card>
      </div>
    </Layout>
  );
}

export async function importCsvPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/auth/signin');
  }
  
  const db = createDb(c.env.DB);
  const allFolders = await db.select().from(folders);
  
  const icons = {
    upload: `<svg class="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>`,
    download: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
  };
  
  return c.html(
    <Layout user={user} currentPath="/test-plan" title="Import Test Cases">
      <div class="p-8 max-w-2xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-neutral-900 mb-2">Import Test Cases</h1>
          <p class="text-neutral-600">Upload a CSV file to import test cases in bulk</p>
        </div>
        
        <Card>
          <form 
            action="/api/test-cases/import" 
            method="POST" 
            enctype="multipart/form-data"
            class="space-y-6"
          >
            {/* Folder Selection */}
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Target Folder (Optional)
              </label>
              <select
                name="folderId"
                class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Root (No Folder)</option>
                {allFolders.map((folder: Folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
              <p class="text-xs text-neutral-500 mt-1">
                Select a folder to import test cases into, or leave empty for root level.
              </p>
            </div>
            
            {/* File Upload */}
            <div x-data="{ fileName: '' }">
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                CSV File <span class="text-danger-500">*</span>
              </label>
              <div 
                class="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50/50 transition-colors cursor-pointer"
                x-on:click="$refs.fileInput.click()"
              >
                <div class="mx-auto w-fit mb-4" dangerouslySetInnerHTML={{ __html: icons.upload }} />
                <input
                  type="file"
                  name="file"
                  accept=".csv"
                  required
                  x-ref="fileInput"
                  class="hidden"
                  x-on:change="fileName = $event.target.files[0]?.name || ''"
                />
                <div x-show="!fileName">
                  <p class="text-base font-medium text-neutral-700 mb-1">
                    Click to choose a file
                  </p>
                  <p class="text-sm text-neutral-500">
                    or drag and drop your CSV file here
                  </p>
                </div>
                <div x-show="fileName" class="text-primary-600">
                  <p class="text-base font-medium" x-text="fileName"></p>
                  <p class="text-sm text-neutral-500">Click to change file</p>
                </div>
              </div>
            </div>
            
            {/* CSV Format Info */}
            <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
              <h4 class="text-sm font-medium text-neutral-900 mb-2">Expected CSV Format</h4>
              <p class="text-xs text-neutral-600 mb-2">
                Your CSV should include the following columns:
              </p>
              <code class="block text-xs bg-white p-2 rounded border border-neutral-200">
                title, description, priority, preConditions, isAutomated, status
              </code>
              <p class="text-xs text-neutral-500 mt-2">
                • <strong>title</strong> (required): Test case title<br />
                • <strong>description</strong>: Test case description<br />
                • <strong>priority</strong>: Critical, High, Medium, Low<br />
                • <strong>preConditions</strong>: Prerequisites<br />
                • <strong>isAutomated</strong>: true/false<br />
                • <strong>status</strong>: Draft, Active, Deprecated
              </p>
            </div>
            
            {/* Actions */}
            <div class="flex justify-between items-center pt-4 border-t border-neutral-200">
              <a
                href="/api/test-cases/export?format=template"
                class="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <span dangerouslySetInnerHTML={{ __html: icons.download }} />
                Download Template
              </a>
              <div class="flex gap-3">
                <Button variant="ghost" href="/test-plan">Cancel</Button>
                <Button variant="primary" type="submit">Import</Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
}


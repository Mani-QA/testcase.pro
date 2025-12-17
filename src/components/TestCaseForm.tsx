import type { FC } from 'hono/jsx';
import type { Folder } from '../types';
import { Button } from './Button';

interface TestCaseFormProps {
  testCase?: {
    id?: number;
    title?: string;
    description?: string | null;
    preConditions?: string | null;
    priority?: string | null;
    status?: string | null;
    isAutomated?: boolean;
    folderId?: number | null;
    steps?: { action: string; expectedResult: string | null }[];
    tags?: { name: string }[];
  } | null;
  folders: Folder[];
  availableTags: string[];
  isEdit?: boolean;
}

export const TestCaseForm: FC<TestCaseFormProps> = ({ 
  testCase, 
  folders, 
  availableTags,
  isEdit = false,
}) => {
  const action = isEdit && testCase?.id 
    ? `/api/test-cases/${testCase.id}` 
    : '/api/test-cases';
  const method = isEdit ? 'PUT' : 'POST';
  
  return (
    <form
      x-data={`{
        steps: ${JSON.stringify(testCase?.steps || [{ action: '', expectedResult: '' }])},
        tags: ${JSON.stringify(testCase?.tags?.map(t => t.name) || [])},
        newTag: '',
        addStep() {
          this.steps.push({ action: '', expectedResult: '' });
        },
        removeStep(index) {
          if (this.steps.length > 1) {
            this.steps.splice(index, 1);
          }
        },
        addTag() {
          if (this.newTag && !this.tags.includes(this.newTag)) {
            this.tags.push(this.newTag);
            this.newTag = '';
          }
        },
        removeTag(tag) {
          this.tags = this.tags.filter(t => t !== tag);
        }
      }`}
      action={action}
      method="POST"
      class="space-y-6"
    >
      {isEdit && <input type="hidden" name="_method" value="PUT" />}
      {/* Title */}
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-2">
          Title <span class="text-danger-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={testCase?.title || ''}
          required
          class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Enter test case title"
        />
      </div>
      
      {/* Description */}
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-2">
          Description
        </label>
        <textarea
          name="description"
          rows={3}
          class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Enter test case description"
        >{testCase?.description || ''}</textarea>
      </div>
      
      {/* Pre-conditions */}
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-2">
          Pre-conditions
        </label>
        <textarea
          name="preConditions"
          rows={2}
          class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Enter pre-conditions (e.g., Login with [Role])"
        >{testCase?.preConditions || ''}</textarea>
      </div>
      
      {/* Priority, Status, Folder */}
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-2">
            Priority
          </label>
          <select
            name="priority"
            class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="High" selected={testCase?.priority === 'High'}>High</option>
            <option value="Medium" selected={testCase?.priority === 'Medium' || !testCase?.priority}>Medium</option>
            <option value="Low" selected={testCase?.priority === 'Low'}>Low</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-2">
            Status
          </label>
          <select
            name="status"
            class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="Draft" selected={testCase?.status === 'Draft' || !testCase?.status}>Draft</option>
            <option value="Under Review" selected={testCase?.status === 'Under Review'}>Under Review</option>
            <option value="Baselined" selected={testCase?.status === 'Baselined'}>Baselined</option>
            <option value="Outdated" selected={testCase?.status === 'Outdated'}>Outdated</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-neutral-700 mb-2">
            Folder
          </label>
          <select
            name="folderId"
            class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">No folder</option>
            {folders.map(folder => (
              <option 
                key={folder.id} 
                value={folder.id}
                selected={testCase?.folderId === folder.id}
              >
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Automated checkbox */}
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          name="isAutomated"
          id="isAutomated"
          value="true"
          checked={testCase?.isAutomated}
          class="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
        />
        <label for="isAutomated" class="text-sm font-medium text-neutral-700">
          Automated Test Case
        </label>
      </div>
      
      {/* Test Steps */}
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-2">
          Test Steps
        </label>
        <div class="space-y-3">
          <template x-for="(step, index) in steps" x-bind:key="index">
            <div class="flex gap-3 items-start p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div class="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                <span x-text="index + 1"></span>
              </div>
              <div class="flex-1 space-y-2">
                <input
                  type="text"
                  x-model="step.action"
                  x-bind:name="`steps[${index}].action`"
                  placeholder="Step action"
                  class="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <input
                  type="text"
                  x-model="step.expectedResult"
                  x-bind:name="`steps[${index}].expectedResult`"
                  placeholder="Expected result"
                  class="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                type="button"
                x-on:click="removeStep(index)"
                x-show="steps.length > 1"
                class="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </template>
        </div>
        <button
          type="button"
          x-on:click="addStep()"
          class="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Step
        </button>
      </div>
      
      {/* Tags */}
      <div>
        <label class="block text-sm font-medium text-neutral-700 mb-2">
          Tags
        </label>
        <div class="flex flex-wrap gap-2 mb-3">
          <template x-for="tag in tags" x-bind:key="tag">
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm">
              <span x-text="tag"></span>
              <button type="button" x-on:click="removeTag(tag)" class="hover:text-primary-600">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <input type="hidden" name="tags[]" x-bind:value="tag" />
            </span>
          </template>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            x-model="newTag"
            list="available-tags"
            {...{"x-on:keydown.enter.prevent": "addTag()"}}
            placeholder="Add a tag"
            class="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <datalist id="available-tags">
            {availableTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <button
            type="button"
            x-on:click="addTag()"
            class="px-4 py-2 text-primary-600 hover:bg-primary-50 border border-primary-300 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>
      
      {/* Form Actions */}
      <div class="flex justify-end gap-3 pt-4 border-t border-neutral-200">
        <Button variant="ghost" href="/test-plan">
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {isEdit ? 'Update Test Case' : 'Create Test Case'}
        </Button>
      </div>
    </form>
  );
};


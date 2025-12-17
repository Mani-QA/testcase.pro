import type { FC } from 'hono/jsx';
import { Card } from './Card';
import { Badge } from './Badge';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { generateTestCaseId, formatDate, PRIORITY_COLORS } from '../lib/utils';

interface TestCaseCardProps {
  testCase: {
    id: number;
    title: string;
    description: string | null;
    priority: string | null;
    status: string | null;
    isAutomated: boolean;
    createdAt: string | null;
    steps?: any[];
    tags?: any[];
    author?: { fullName: string | null; email: string } | null;
  };
  canEdit: boolean;
  selectMode?: boolean;
  isSelected?: boolean;
}

const icons = {
  view: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
  edit: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`,
  delete: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
  checkSquare: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  square: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2"/></svg>`,
};

export const TestCaseCard: FC<TestCaseCardProps> = ({ 
  testCase, 
  canEdit, 
  selectMode = false,
  isSelected = false,
}) => {
  const priorityVariant = PRIORITY_COLORS[testCase.priority || 'Medium'] as any || 'neutral';
  
  return (
    <Card padding={false}>
      <div class="p-6">
        {/* Header row with ID and action buttons */}
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            {/* Checkbox (Select Mode) */}
            {selectMode && canEdit && (
              <button
                type="button"
                class="p-1 hover:bg-neutral-100 rounded transition-colors"
                hx-post={isSelected ? `/api/test-cases/${testCase.id}/deselect` : `/api/test-cases/${testCase.id}/select`}
                hx-target="closest .card"
                hx-swap="outerHTML"
              >
                <span class={isSelected ? 'text-primary-600' : 'text-neutral-400'} 
                      dangerouslySetInnerHTML={{ __html: isSelected ? icons.checkSquare : icons.square }} />
              </button>
            )}
            <span class="text-sm font-mono text-primary-600">
              {generateTestCaseId(testCase.id)}
            </span>
          </div>
          
          {/* Action Buttons (Only when NOT in select mode) */}
          {!selectMode && canEdit && (
            <div class="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                icon={icons.edit}
                href={`/test-case/${testCase.id}/edit`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={icons.delete}
                onClick={`if(confirm('Are you sure you want to delete this test case?')) { htmx.ajax('DELETE', '/api/test-cases/${testCase.id}', {target: '#test-cases-list', swap: 'innerHTML'}); }`}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
        
        {/* Title - Clickable to view test case */}
        <h3 class="text-lg font-semibold mb-2">
          <a 
            href={`/test-case/${testCase.id}`}
            class="text-neutral-900 hover:text-primary-600 transition-colors"
          >
            {testCase.title}
          </a>
        </h3>
        
        {/* Description */}
        {testCase.description && (
          <p class="text-sm text-neutral-600 mb-3 line-clamp-2">
            {testCase.description}
          </p>
        )}
        
        {/* Badges */}
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant={priorityVariant}>
            {testCase.priority || 'Medium'}
          </Badge>
          <StatusBadge status={testCase.status || 'Draft'} type="case" />
          {testCase.isAutomated && (
            <Badge variant="info">Automated</Badge>
          )}
          {testCase.tags?.map((tag: any) => (
            <Badge key={tag.id} variant="neutral">{tag.name}</Badge>
          ))}
        </div>
        
        <div class="text-xs text-neutral-500 pt-3 border-t border-neutral-100 mt-4">
          Created {formatDate(testCase.createdAt)} 
          {testCase.author && ` by ${testCase.author.fullName || testCase.author.email}`}
        </div>
      </div>
    </Card>
  );
};


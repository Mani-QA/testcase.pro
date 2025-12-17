import type { FC } from 'hono/jsx';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../lib/utils';

interface TestSuiteCardProps {
  suite: {
    id: number;
    title: string;
    description: string | null;
    status: string | null;
    createdAt: string | null;
    creator?: { fullName: string | null; email: string } | null;
    stats: {
      total: number;
      passed: number;
      failed: number;
      blocked: number;
      notRun: number;
    };
  };
  canEdit: boolean;
}

export const TestSuiteCard: FC<TestSuiteCardProps> = ({ suite, canEdit }) => {
  const { stats } = suite;
  const executed = stats.passed + stats.failed + stats.blocked;
  const passRate = stats.total > 0 ? Math.round((executed / stats.total) * 100) : 0;
  
  return (
    <a 
      href={`/test-run/${suite.id}`}
      class="block bg-white rounded-lg border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div class="p-3 sm:p-4">
        {/* Row 1: Title + Status + Delete */}
        <div class="flex items-start sm:items-center justify-between gap-2 mb-2">
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            <h3 class="text-sm sm:text-base font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors truncate">{suite.title}</h3>
            <StatusBadge status={suite.status || 'In Progress'} />
          </div>
          {canEdit && (
            <button
              type="button"
              class="p-1.5 text-neutral-400 sm:text-neutral-300 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
              title="Delete"
              onClick={`event.preventDefault(); event.stopPropagation(); if(confirm('Delete this test suite?')) { htmx.ajax('DELETE', '/api/test-suites/${suite.id}', {target: '#test-suites-list', swap: 'innerHTML'}); }`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>
        
        {/* Row 2: Description (optional) - Hidden on mobile */}
        {suite.description && (
          <p class="hidden sm:block text-sm text-neutral-500 mb-3">{suite.description}</p>
        )}
        
        {/* Row 3: Progress bar with stats */}
        <div class="bg-neutral-50 rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3">
          <div class="flex items-center justify-between mb-1.5 sm:mb-2">
            <span class="text-xs font-medium text-neutral-600">Progress</span>
            <span class="text-xs sm:text-sm font-semibold text-primary-600">{passRate}%</span>
          </div>
          <div class="h-2 sm:h-2.5 bg-neutral-200 rounded-full overflow-hidden flex mb-2 sm:mb-2.5">
            {stats.passed > 0 && (
              <div style={`width: ${(stats.passed / stats.total) * 100}%; height: 100%; background-color: #22c55e;`} />
            )}
            {stats.failed > 0 && (
              <div style={`width: ${(stats.failed / stats.total) * 100}%; height: 100%; background-color: #ef4444;`} />
            )}
            {stats.blocked > 0 && (
              <div style={`width: ${(stats.blocked / stats.total) * 100}%; height: 100%; background-color: #f59e0b;`} />
            )}
          </div>
          {/* Mobile: 2x2 grid, Desktop: horizontal */}
          <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-xs">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-success-500"></span>
              <span class="text-neutral-600">{stats.passed}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-danger-500"></span>
              <span class="text-neutral-600">{stats.failed}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-warning-500"></span>
              <span class="text-neutral-600">{stats.blocked}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-300"></span>
              <span class="text-neutral-600">{stats.notRun}</span>
            </span>
          </div>
        </div>
        
        {/* Row 4: Footer info */}
        <div class="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-100">
          <span>{formatDate(suite.createdAt)}</span>
          {suite.creator && (
            <span class="hidden sm:flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              {suite.creator.fullName || suite.creator.email}
            </span>
          )}
        </div>
      </div>
    </a>
  );
};


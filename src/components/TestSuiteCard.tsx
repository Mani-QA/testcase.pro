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
      <div class="p-4">
        {/* Row 1: Title + Status + Delete */}
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">{suite.title}</h3>
            <StatusBadge status={suite.status || 'In Progress'} />
          </div>
          {canEdit && (
            <button
              type="button"
              class="p-1.5 text-neutral-300 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Delete"
              onClick={`event.preventDefault(); event.stopPropagation(); if(confirm('Delete this test suite?')) { htmx.ajax('DELETE', '/api/test-suites/${suite.id}', {target: '#test-suites-list', swap: 'innerHTML'}); }`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>
        
        {/* Row 2: Description (optional) */}
        {suite.description && (
          <p class="text-sm text-neutral-500 mb-3">{suite.description}</p>
        )}
        
        {/* Row 3: Progress bar with stats */}
        <div style="background-color: #fafafa; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 500; color: #525252;">Execution Progress</span>
            <span style="font-size: 14px; font-weight: 600; color: #0284c7;">{passRate}% Complete</span>
          </div>
          <div style="height: 10px; background-color: #e5e5e5; border-radius: 9999px; overflow: hidden; display: flex; margin-bottom: 10px;">
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
          <div style="display: flex; align-items: center; gap: 16px; font-size: 12px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 9999px; background-color: #22c55e;"></span>
              <span style="color: #525252;">Passed: {stats.passed}</span>
            </span>
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 9999px; background-color: #ef4444;"></span>
              <span style="color: #525252;">Failed: {stats.failed}</span>
            </span>
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 9999px; background-color: #f59e0b;"></span>
              <span style="color: #525252;">Blocked: {stats.blocked}</span>
            </span>
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 9999px; background-color: #d4d4d4;"></span>
              <span style="color: #525252;">Not Run: {stats.notRun}</span>
            </span>
          </div>
        </div>
        
        {/* Row 4: Footer info */}
        <div class="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-100">
          <span>Created {formatDate(suite.createdAt)}</span>
          {suite.creator && (
            <span class="flex items-center gap-1">
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


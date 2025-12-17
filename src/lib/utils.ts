import { format, formatDistanceToNow } from 'date-fns';

// Generate test case ID with prefix
export function generateTestCaseId(id: number): string {
  return `TC-${id.toString().padStart(4, '0')}`;
}

// Format date for display
export function formatDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

// Format relative time
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'N/A';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return 'Invalid date';
  }
}

// Combine class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Parse CSV data for import
export function parseCSVRow(row: Record<string, string>): {
  id?: string;
  title?: string;
  description?: string;
  preconditions?: string;
  priority?: string;
  status?: string;
  automated?: string;
  location?: string;
  tags?: string;
  stepnumber?: string;
  stepaction?: string;
  expectedresult?: string;
} {
  // Normalize keys to lowercase and remove spaces
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    normalized[normalizedKey] = value;
  }
  
  return {
    id: normalized['id'] || normalized['testcaseid'],
    title: normalized['title'] || normalized['name'] || normalized['testcasename'],
    description: normalized['description'] || normalized['desc'],
    preconditions: normalized['preconditions'] || normalized['precondition'] || normalized['prerequisites'],
    priority: normalized['priority'],
    status: normalized['status'],
    automated: normalized['automated'] || normalized['isautomated'],
    location: normalized['location'] || normalized['folder'] || normalized['path'],
    tags: normalized['tags'] || normalized['labels'],
    stepnumber: normalized['stepnumber'] || normalized['step'] || normalized['stepno'],
    stepaction: normalized['stepaction'] || normalized['action'] || normalized['teststep'],
    expectedresult: normalized['expectedresult'] || normalized['expected'] || normalized['expectedoutput'],
  };
}

// Status color mappings
export const STATUS_COLORS: Record<string, string> = {
  'Passed': '#22c55e',
  'Failed': '#ef4444',
  'Blocked': '#f59e0b',
  'Not Run': '#a3a3a3',
  'In Progress': '#3b82f6',
  'Hold': '#f59e0b',
  'Invalid': '#737373',
  'Draft': '#a3a3a3',
  'Under Review': '#3b82f6',
  'Baselined': '#22c55e',
  'Outdated': '#f59e0b',
};

// Priority color mappings
export const PRIORITY_COLORS: Record<string, string> = {
  'High': 'danger',
  'Medium': 'warning',
  'Low': 'neutral',
};


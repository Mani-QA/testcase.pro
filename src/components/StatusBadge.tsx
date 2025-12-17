import type { FC } from 'hono/jsx';
import { Badge } from './Badge';

interface StatusBadgeProps {
  status: string;
  type?: 'case' | 'run';
}

const statusVariants: Record<string, 'success' | 'danger' | 'warning' | 'neutral' | 'info' | 'primary'> = {
  'Passed': 'success',
  'Failed': 'danger',
  'Blocked': 'warning',
  'Not Run': 'neutral',
  'In Progress': 'info',
  'Hold': 'warning',
  'Invalid': 'neutral',
  'Draft': 'neutral',
  'Under Review': 'info',
  'Baselined': 'success',
  'Outdated': 'warning',
  'Completed': 'success',
};

export const StatusBadge: FC<StatusBadgeProps> = ({ status, type = 'run' }) => {
  const variant = statusVariants[status] || 'neutral';
  return <Badge variant={variant}>{status}</Badge>;
};


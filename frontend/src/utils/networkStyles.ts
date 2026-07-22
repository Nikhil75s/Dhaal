export const NODE_COLORS: Record<string, string> = {
  case: '#D4AF37',     // accent-gold
  accused: '#EF4444',  // critical (red)
  victim: '#3B82F6',   // accent-blue
};

export const nodeColor = (group: string) => NODE_COLORS[group] ?? '#3B82F6';

export const GROUP_LABELS: Record<string, string> = {
  accused: 'Suspects',
  case: 'Cases',
  victim: 'Victims',
};

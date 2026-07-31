/**
 * PageState.js
 * Reusable page-level UI helpers: PageHeader, Loading spinner, EmptyState.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Standard page header with an optional actions slot.
 *
 * @param {string}      title
 * @param {string}      [description]
 * @param {React.Node}  [actions]   – buttons / controls rendered to the right
 */
export const PageHeader = ({ title, description, actions }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

/**
 * Centered loading spinner with an optional label.
 *
 * @param {string} [label]
 */
export const Loading = ({ label = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
    <Loader2 className="w-8 h-8 animate-spin" />
    <p className="text-sm">{label}</p>
  </div>
);

/**
 * Empty-state placeholder with an icon, title, description, and optional action button.
 *
 * @param {React.ElementType} icon
 * @param {string}            title
 * @param {string}            [description]
 * @param {React.Node}        [action]
 */
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
    {Icon && <Icon className="w-12 h-12 text-gray-300" />}
    <p className="text-base font-medium text-gray-500">{title}</p>
    {description && <p className="text-sm text-gray-400 text-center max-w-xs">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

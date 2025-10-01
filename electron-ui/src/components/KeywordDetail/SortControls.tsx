/**
 * SortControls Component
 * Provides sort mode selector for subject list
 */

import React from 'react';
import { ArrowUpDown, Clock, User, TrendingUp } from 'lucide-react';
import type { SubjectSortMode } from '../../types/keyword-detail.js';

interface SortControlsProps {
  sortMode: SubjectSortMode;
  onSortChange: (mode: SubjectSortMode) => void;
  className?: string;
}

export const SortControls: React.FC<SortControlsProps> = ({
  sortMode,
  onSortChange,
  className = ''
}) => {
  const sortOptions: Array<{
    value: SubjectSortMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      value: 'relevance',
      label: 'Relevance',
      icon: <TrendingUp className="w-4 h-4" />
    },
    {
      value: 'time',
      label: 'Time',
      icon: <Clock className="w-4 h-4" />
    },
    {
      value: 'author',
      label: 'Author',
      icon: <User className="w-4 h-4" />
    }
  ];

  return (
    <div className={`sort-controls ${className}`}>
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600 font-medium">Sort by:</span>
        <div className="flex gap-1">
          {sortOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onSortChange(option.value)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all
                ${
                  sortMode === option.value
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
              aria-pressed={sortMode === option.value}
              aria-label={`Sort by ${option.label}`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

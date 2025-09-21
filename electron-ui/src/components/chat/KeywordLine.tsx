/**
 * KeywordLine Component
 * Displays current chat keywords in a simple horizontally scrollable line
 * As specified in 006-current-keywords-for spec
 */

import React from 'react';
import { Badge } from '../ui/badge';

interface KeywordLineProps {
  keywords: string[];
  maxLines?: number;
  className?: string;
}

export const KeywordLine: React.FC<KeywordLineProps> = ({
  keywords,
  maxLines = 1,
  className = ''
}) => {
  if (!keywords || keywords.length === 0) {
    return null;
  }

  // Calculate max height based on number of lines
  const maxHeight = maxLines * 1.5; // 1.5rem per line

  return (
    <div
      className={`w-full border-b border-gray-200 bg-gray-50 px-4 py-2 ${className}`}
      style={{ maxHeight: `${maxHeight}rem` }}
    >
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300">
        {keywords.map((keyword, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex-shrink-0 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100"
          >
            {keyword}
          </Badge>
        ))}
      </div>
    </div>
  );
};
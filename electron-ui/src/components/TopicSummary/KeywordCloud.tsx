/**
 * KeywordCloud Component
 * Displays keywords in a visual cloud format
 */

import React, { useMemo } from 'react';
import { Badge } from '../ui/badge.js';
import type { Keyword } from '../../types/topic-analysis.js';
import { useWordCloudSettings } from '../../hooks/useWordCloudSettings.js';

interface KeywordCloudProps {
  keywords: Keyword[] | string[];
  maxDisplay?: number;
  onKeywordClick?: (keyword: string) => void;
  className?: string;
}

interface CloudKeyword {
  text: string;
  size: number;
  frequency?: number;
  score?: number;
  subjects?: string[]; // Array of subject IDs
}

export const KeywordCloud: React.FC<KeywordCloudProps> = ({
  keywords,
  maxDisplay, // Will use settings if not provided
  onKeywordClick,
  className = ''
}) => {
  const { settings } = useWordCloudSettings();

  // Use settings value if maxDisplay not provided via props
  const effectiveMaxDisplay = maxDisplay ?? settings.maxWordsPerSubject;
  const cloudData = useMemo(() => {
    // Convert to CloudKeyword format
    let cloudKeywords: CloudKeyword[];

    if (keywords.length === 0) return [];

    if (typeof keywords[0] === 'string') {
      // Simple string array - assign decreasing sizes
      cloudKeywords = (keywords as string[]).slice(0, effectiveMaxDisplay).map((text, index) => ({
        text,
        size: Math.max(1, 10 - Math.floor(index / 3))
      }));
    } else {
      // Keyword objects with frequency/score
      const keywordObjects = keywords as Keyword[];

      // Filter by minimum frequency setting
      const filteredKeywords = keywordObjects.filter(
        k => (k.frequency || 1) >= settings.minWordFrequency
      );

      // Calculate weights
      const maxFreq = Math.max(...filteredKeywords.map(k => k.frequency || 1));

      cloudKeywords = filteredKeywords.slice(0, effectiveMaxDisplay).map(keyword => ({
        text: keyword.text || keyword.term || '',
        size: Math.ceil(((keyword.frequency || 1) / maxFreq) * 10),
        frequency: keyword.frequency,
        score: keyword.score,
        subjects: keyword.subjects || []
      }));
    }

    // Shuffle for better visual distribution
    return shuffleArray(cloudKeywords);
  }, [keywords, effectiveMaxDisplay, settings.minWordFrequency]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const getSizeClass = (size: number): string => {
    // Scale size based on settings
    const scaledSize = settings.fontScaleMin +
      (size / 10) * (settings.fontScaleMax - settings.fontScaleMin);

    if (scaledSize >= 2.0) return 'text-xl font-bold';
    if (scaledSize >= 1.5) return 'text-lg font-semibold';
    if (scaledSize >= 1.2) return 'text-base font-medium';
    if (scaledSize >= 1.0) return 'text-sm';
    return 'text-xs';
  };

  const getColorClass = (size: number): string => {
    const colorSchemes = {
      viridis: {
        high: 'text-emerald-700 hover:text-emerald-800',
        medHigh: 'text-teal-600 hover:text-teal-700',
        medium: 'text-cyan-600 hover:text-cyan-700',
        medLow: 'text-slate-600 hover:text-slate-700',
        low: 'text-gray-500 hover:text-gray-600'
      },
      plasma: {
        high: 'text-purple-700 hover:text-purple-800',
        medHigh: 'text-violet-600 hover:text-violet-700',
        medium: 'text-fuchsia-600 hover:text-fuchsia-700',
        medLow: 'text-pink-600 hover:text-pink-700',
        low: 'text-gray-500 hover:text-gray-600'
      },
      blues: {
        high: 'text-blue-700 hover:text-blue-800',
        medHigh: 'text-blue-600 hover:text-blue-700',
        medium: 'text-sky-600 hover:text-sky-700',
        medLow: 'text-slate-600 hover:text-slate-700',
        low: 'text-gray-500 hover:text-gray-600'
      },
      greens: {
        high: 'text-green-700 hover:text-green-800',
        medHigh: 'text-green-600 hover:text-green-700',
        medium: 'text-emerald-600 hover:text-emerald-700',
        medLow: 'text-teal-600 hover:text-teal-700',
        low: 'text-gray-500 hover:text-gray-600'
      },
      oranges: {
        high: 'text-orange-700 hover:text-orange-800',
        medHigh: 'text-orange-600 hover:text-orange-700',
        medium: 'text-amber-600 hover:text-amber-700',
        medLow: 'text-yellow-600 hover:text-yellow-700',
        low: 'text-gray-500 hover:text-gray-600'
      },
      greys: {
        high: 'text-gray-900 hover:text-black',
        medHigh: 'text-gray-700 hover:text-gray-800',
        medium: 'text-gray-600 hover:text-gray-700',
        medLow: 'text-gray-500 hover:text-gray-600',
        low: 'text-gray-400 hover:text-gray-500'
      }
    };

    const scheme = colorSchemes[settings.colorScheme as keyof typeof colorSchemes] || colorSchemes.blues;

    if (size >= 9) return scheme.high;
    if (size >= 7) return scheme.medHigh;
    if (size >= 5) return scheme.medium;
    if (size >= 3) return scheme.medLow;
    return scheme.low;
  };

  if (cloudData.length === 0) {
    return (
      <div className={`text-center text-gray-500 p-8 ${className}`}>
        <p>No keywords to display</p>
      </div>
    );
  }

  const getLayoutClasses = (): string => {
    const layouts = {
      compact: 'gap-1 p-2',
      medium: 'gap-2 p-4',
      spacious: 'gap-4 p-6'
    };
    return layouts[settings.layoutDensity as keyof typeof layouts] || layouts.medium;
  };

  return (
    <div className={`keyword-cloud ${className}`}>
      <div className={`flex flex-wrap justify-center items-center ${getLayoutClasses()}`}>
        {cloudData.map((keyword, index) => {
          const sizeClass = getSizeClass(keyword.size);
          const colorClass = getColorClass(keyword.size);

          return (
            <button
              key={`${keyword.text}-${index}`}
              onClick={() => onKeywordClick?.(keyword.text)}
              className={`
                inline-block px-2 py-1 transition-all duration-200
                ${colorClass} ${sizeClass}
                ${onKeywordClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
              `}
              title={
                keyword.frequency
                  ? `Frequency: ${keyword.frequency}${
                      keyword.score ? `, Score: ${keyword.score.toFixed(2)}` : ''
                    }${
                      keyword.subjects && keyword.subjects.length > 0
                        ? `\nSubjects: ${keyword.subjects.length}`
                        : ''
                    }`
                  : undefined
              }
            >
              {keyword.text}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="text-lg text-blue-700">●</span>
          <span>High frequency</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">●</span>
          <span>Medium frequency</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">●</span>
          <span>Low frequency</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Alternative compact view for sidebars
 */
export const KeywordList: React.FC<{
  keywords: string[];
  limit?: number;
  onKeywordClick?: (keyword: string) => void;
  className?: string;
}> = ({ keywords, limit = 10, onKeywordClick, className = '' }) => {
  const displayKeywords = keywords.slice(0, limit);
  const remaining = keywords.length - limit;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayKeywords.map((keyword, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          className={`text-xs ${onKeywordClick ? 'cursor-pointer hover:bg-gray-200' : ''}`}
          onClick={() => onKeywordClick?.(keyword)}
        >
          {keyword}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
};
/**
 * ProposalCard Component
 * Displays a single knowledge sharing proposal
 *
 * Reference: /specs/019-above-the-chat/plan.md line 127
 */

import React from 'react';
import type { Proposal } from '../types/proposals';

interface ProposalCardProps {
  proposal: Proposal;
  onShare: () => void;
  onDismiss: () => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onShare,
  onDismiss,
}) => {
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <div className="proposal-card bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm border border-blue-200 dark:border-blue-700 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow w-full">
      <div className="flex items-center gap-2 min-h-0">
        {/* Keywords (scrollable) */}
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="flex gap-1">
            {proposal.matchedKeywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded whitespace-nowrap"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* Match score */}
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {Math.round(proposal.relevanceScore * 100)}%
        </span>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
        >
          Share
        </button>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

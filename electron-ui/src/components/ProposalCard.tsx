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
    <div className="proposal-card bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-sm border border-blue-200 dark:border-blue-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Related: {proposal.pastSubjectName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(proposal.relevanceScore * 100)}% match
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {proposal.matchedKeywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={handleShare}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
          >
            Share
          </button>
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
    </div>
  );
};

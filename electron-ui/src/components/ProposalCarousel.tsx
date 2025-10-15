/**
 * ProposalCarousel Component
 * Swipeable carousel for navigating through proposals
 *
 * Reference: /specs/019-above-the-chat/plan.md line 128
 * Reference: /specs/019-above-the-chat/research.md lines 32-45
 */

import React from 'react';
import { useSwipeable } from 'react-swipeable';
import { ProposalCard } from './ProposalCard';
import type { Proposal } from '../types/proposals';

interface ProposalCarouselProps {
  proposals: Proposal[];
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onShare: (proposalId: string, pastSubjectIdHash: string) => Promise<void>;
  onDismiss: (proposalId: string, pastSubjectIdHash: string) => Promise<void>;
}

export const ProposalCarousel: React.FC<ProposalCarouselProps> = ({
  proposals,
  currentIndex,
  onNext,
  onPrevious,
  onShare,
  onDismiss,
}) => {
  const currentProposal = proposals[currentIndex];

  // Configure swipeable handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => onNext(),
    onSwipedRight: () => onPrevious(),
    preventScrollOnSwipe: true,
    trackMouse: true, // Enable mouse drag for desktop
  });

  if (!currentProposal || proposals.length === 0) {
    return null;
  }

  const handleShare = async () => {
    await onShare(currentProposal.id, currentProposal.pastSubject);
  };

  const handleDismiss = async () => {
    await onDismiss(currentProposal.id, currentProposal.pastSubject);
  };

  return (
    <div className="proposal-carousel mb-4" {...handlers}>
      <ProposalCard
        proposal={currentProposal}
        onShare={handleShare}
        onDismiss={handleDismiss}
      />

      {proposals.length > 1 && (
        <div className="flex justify-center items-center gap-2 mt-2">
          <button
            onClick={onPrevious}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            aria-label="Previous proposal"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {proposals.length}
          </span>

          <button
            onClick={onNext}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            aria-label="Next proposal"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}

    </div>
  );
};

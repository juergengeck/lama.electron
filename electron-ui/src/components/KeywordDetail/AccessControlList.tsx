/**
 * AccessControlList Component
 * Displays and manages access control states for users and groups
 */

import React, { useState } from 'react';
import { User, Users, Shield, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge.js';
import { ScrollArea } from '../ui/scroll-area.js';
import type {
  KeywordAccessState,
  AccessStateValue,
  PrincipalType,
  AllPrincipals
} from '../../types/keyword-detail.js';

interface AccessControlListProps {
  keyword: string;
  accessStates: KeywordAccessState[];
  allPrincipals?: AllPrincipals;
  onAccessChange: (principalId: string, principalType: PrincipalType, newState: AccessStateValue) => Promise<void>;
  className?: string;
}

interface AccessControlItemProps {
  principalName: string;
  principalType: PrincipalType;
  currentState: AccessStateValue;
  loading: boolean;
  onStateChange: (newState: AccessStateValue) => void;
}

const AccessControlItem: React.FC<AccessControlItemProps> = ({
  principalName,
  principalType,
  currentState,
  loading,
  onStateChange
}) => {
  const stateOptions: Array<{ value: AccessStateValue; label: string; color: string }> = [
    { value: 'allow', label: 'Allow', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'deny', label: 'Deny', color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'none', label: 'None', color: 'bg-gray-100 text-gray-600 border-gray-300' }
  ];

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        {principalType === 'user' ? (
          <User className="w-4 h-4 text-gray-500" />
        ) : (
          <Users className="w-4 h-4 text-gray-500" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-800">{principalName}</p>
          <p className="text-xs text-gray-500 capitalize">{principalType}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        <div className="flex gap-1">
          {stateOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onStateChange(option.value)}
              disabled={loading}
              className={`
                px-2 py-1 rounded text-xs font-medium border transition-all
                ${
                  currentState === option.value
                    ? option.color
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={currentState === option.value}
              aria-label={`Set access to ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AccessControlList: React.FC<AccessControlListProps> = ({
  keyword,
  accessStates,
  allPrincipals,
  onAccessChange,
  className = ''
}) => {
  const [loadingPrincipal, setLoadingPrincipal] = useState<string | null>(null);

  const handleStateChange = async (
    principalId: string,
    principalType: PrincipalType,
    newState: AccessStateValue
  ) => {
    console.log('[AccessControlList] Changing access state:', {
      principalId,
      principalType,
      newState
    });

    setLoadingPrincipal(principalId);
    try {
      await onAccessChange(principalId, principalType, newState);
    } catch (error) {
      console.error('[AccessControlList] Error changing access state:', error);
    } finally {
      setLoadingPrincipal(null);
    }
  };

  const getAccessState = (principalId: string): AccessStateValue => {
    const state = accessStates.find(s => s.principalId === principalId);
    return state?.state || 'none';
  };

  // Combine principals with access states
  const userPrincipals = allPrincipals?.users || [];
  const groupPrincipals = allPrincipals?.groups || [];

  // If no principals provided, derive from access states
  const derivedUsers = accessStates
    .filter(s => s.principalType === 'user')
    .map(s => ({
      id: s.principalId,
      type: 'user' as PrincipalType,
      name: s.principalId.substring(0, 12) + '...'
    }));

  const derivedGroups = accessStates
    .filter(s => s.principalType === 'group')
    .map(s => ({
      id: s.principalId,
      type: 'group' as PrincipalType,
      name: s.principalId.substring(0, 12) + '...'
    }));

  const users = userPrincipals.length > 0 ? userPrincipals : derivedUsers;
  const groups = groupPrincipals.length > 0 ? groupPrincipals : derivedGroups;

  // Empty state
  if (users.length === 0 && groups.length === 0) {
    return (
      <div className={`access-control-list-empty text-center p-8 ${className}`}>
        <Shield className="w-8 h-8 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500">No users or groups available</p>
        <p className="text-sm text-gray-400 mt-2">
          Access control will be available once users or groups are created
        </p>
      </div>
    );
  }

  return (
    <div className={`access-control-list ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Access Control</h3>
        <p className="text-xs text-gray-500">
          Manage who can access information related to "{keyword}"
        </p>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-4">
          {/* Users */}
          {users.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Users ({users.length})
                </span>
              </div>
              {users.map(user => (
                <AccessControlItem
                  key={user.id}
                  principalName={user.name}
                  principalType="user"
                  currentState={getAccessState(user.id)}
                  loading={loadingPrincipal === user.id}
                  onStateChange={newState => handleStateChange(user.id, 'user', newState)}
                />
              ))}
            </>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-4 mb-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Groups ({groups.length})
                </span>
              </div>
              {groups.map(group => (
                <AccessControlItem
                  key={group.id}
                  principalName={group.name}
                  principalType="group"
                  currentState={getAccessState(group.id)}
                  loading={loadingPrincipal === group.id}
                  onStateChange={newState => handleStateChange(group.id, 'group', newState)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            Allow
          </Badge>
          <span>Explicit access</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
            Deny
          </Badge>
          <span>Blocked access</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
            None
          </Badge>
          <span>Default permissions</span>
        </div>
      </div>
    </div>
  );
};

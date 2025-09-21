/**
 * KeywordLineSettings Component
 * Simple settings for keyword line display - just max lines configuration
 * As specified in 006-current-keywords-for spec
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Save } from 'lucide-react';

interface KeywordLineSettingsProps {
  className?: string;
}

export const KeywordLineSettings: React.FC<KeywordLineSettingsProps> = ({
  className = ''
}) => {
  const [maxLines, setMaxLines] = useState(1);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = localStorage.getItem('keyword-line-max-lines');
        if (stored) {
          setMaxLines(parseInt(stored, 10));
        }
      } catch (error) {
        console.error('Failed to load keyword line settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      localStorage.setItem('keyword-line-max-lines', maxLines.toString());

      // Broadcast to all chat windows that settings changed
      window.dispatchEvent(new CustomEvent('keyword-line-settings-changed', {
        detail: { maxLines }
      }));

    } catch (error) {
      console.error('Failed to save keyword line settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLinesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1 && value <= 5) {
      setMaxLines(value);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Chat Keywords Display</CardTitle>
        <CardDescription>
          Configure how keywords are displayed at the top of chat windows
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="maxLines">Maximum Lines for Keyword Display</Label>
          <Input
            id="maxLines"
            type="number"
            min="1"
            max="5"
            value={maxLines}
            onChange={handleLinesChange}
            className="w-20"
          />
          <p className="text-xs text-gray-500">
            Default: 1 line. Keywords will scroll horizontally if they don't fit.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
/**
 * WordCloudSettings Component
 *
 * UI for configuring word cloud visualization settings
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { useWordCloudSettings } from '../../hooks/useWordCloudSettings';
import { Settings, RotateCcw, Save } from 'lucide-react';

interface WordCloudSettingsProps {
  className?: string;
}

export const WordCloudSettings: React.FC<WordCloudSettingsProps> = ({ className = '' }) => {
  const { settings, loading, error, updateSettings, resetSettings } = useWordCloudSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Update local settings when global settings change
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateSettings(localSettings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      await resetSettings();
    } catch (err) {
      console.error('Failed to reset settings:', err);
    } finally {
      setResetting(false);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Word Cloud Settings
        </CardTitle>
        <CardDescription>
          Configure how keywords are displayed in the word cloud visualization
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Display Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Display</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxWords">Max Words per Subject</Label>
              <Input
                id="maxWords"
                type="number"
                min="5"
                max="100"
                value={localSettings.maxWordsPerSubject}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  maxWordsPerSubject: parseInt(e.target.value) || 20
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minFreq">Min Word Frequency</Label>
              <Input
                id="minFreq"
                type="number"
                min="1"
                max="10"
                value={localSettings.minWordFrequency}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  minWordFrequency: parseInt(e.target.value) || 2
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">Related Word Threshold</Label>
            <Input
              id="threshold"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.relatedWordThreshold}
              onChange={(e) => setLocalSettings(prev => ({
                ...prev,
                relatedWordThreshold: parseFloat(e.target.value) || 0.3
              }))}
            />
            <p className="text-xs text-gray-500">
              Minimum similarity score to show related keywords (0.0 - 1.0)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="summaryKeywords"
              checked={localSettings.showSummaryKeywords}
              onCheckedChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                showSummaryKeywords: checked
              }))}
            />
            <Label htmlFor="summaryKeywords">Show Summary Keywords</Label>
          </div>
        </div>

        {/* Visual Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Visual Style</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontMin">Min Font Scale</Label>
              <Input
                id="fontMin"
                type="number"
                min="0.5"
                max="2"
                step="0.1"
                value={localSettings.fontScaleMin}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  fontScaleMin: parseFloat(e.target.value) || 0.8
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontMax">Max Font Scale</Label>
              <Input
                id="fontMax"
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={localSettings.fontScaleMax}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  fontScaleMax: parseFloat(e.target.value) || 2.5
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="colorScheme">Color Scheme</Label>
              <select
                id="colorScheme"
                value={localSettings.colorScheme}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  colorScheme: e.target.value
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="viridis">Viridis (Blue-Green)</option>
                <option value="plasma">Plasma (Purple-Pink)</option>
                <option value="blues">Blues</option>
                <option value="greens">Greens</option>
                <option value="oranges">Oranges</option>
                <option value="greys">Greys</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layoutDensity">Layout Density</Label>
              <select
                id="layoutDensity"
                value={localSettings.layoutDensity}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  layoutDensity: e.target.value
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="compact">Compact</option>
                <option value="medium">Medium</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
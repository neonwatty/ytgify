import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  quotaManager,
  type QuotaStatus,
  type CleanupSuggestion,
  type CleanupPolicy 
} from '@/storage/quota-manager';
import type { StorageEvent } from '@/types/storage';

interface StorageMonitorProps {
  onCleanupComplete?: (deleted: number, reclaimed: number) => void;
  showPolicySettings?: boolean;
  autoStart?: boolean;
}

export const StorageMonitor: React.FC<StorageMonitorProps> = ({
  onCleanupComplete,
  showPolicySettings = true,
  autoStart = true,
}) => {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([]);
  const [detailedUsage, setDetailedUsage] = useState<{
    totalGifs: number;
    totalSize: number;
    averageSize: number;
    largestGif: { id: string; size: number } | null;
    oldestGif: { id: string; age: number } | null;
    sizeDistribution: { range: string; count: number }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupPolicy, setCleanupPolicy] = useState<CleanupPolicy>(quotaManager.getCleanupPolicy());
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const loadQuotaStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = await quotaManager.getQuotaStatus();
      setQuotaStatus(status);
      
      if (status.percentage >= 80) {
        const suggestionsData = await quotaManager.getCleanupSuggestions();
        setSuggestions(suggestionsData);
      }
      
      const usage = await quotaManager.getDetailedUsage();
      setDetailedUsage(usage);
    } catch (error) {
      console.error('Failed to load quota status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoStart) {
      quotaManager.startMonitoring(60000);
    }
    
    loadQuotaStatus();
    
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.type === 'storage-quota-changed') {
        loadQuotaStatus();
      }
    };
    
    quotaManager.addEventListener(handleStorageEvent);
    
    return () => {
      quotaManager.removeEventListener(handleStorageEvent);
      if (autoStart) {
        quotaManager.stopMonitoring();
      }
    };
  }, [autoStart, loadQuotaStatus]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const handleCleanupPolicyChange = (key: keyof CleanupPolicy, value: boolean | number) => {
    const newPolicy = { ...cleanupPolicy, [key]: value };
    setCleanupPolicy(newPolicy);
    quotaManager.setCleanupPolicy(newPolicy);
  };

  const handleCleanupSelected = async () => {
    if (selectedSuggestions.size === 0) return;
    
    setIsCleaningUp(true);
    let totalDeleted = 0;
    let totalReclaimed = 0;
    
    try {
      const selectedItems = Array.from(selectedSuggestions).map(i => suggestions[i]);
      
      for (const suggestion of selectedItems) {
        const deleted = await suggestion.action();
        totalDeleted += deleted;
        totalReclaimed += suggestion.estimatedSavings;
      }
      
      onCleanupComplete?.(totalDeleted, totalReclaimed);
      await loadQuotaStatus();
      setShowCleanupDialog(false);
      setSelectedSuggestions(new Set());
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleAutoCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const result = await quotaManager.performAutoCleanup();
      if (result.success && result.gifsDeleted > 0) {
        onCleanupComplete?.(result.gifsDeleted, result.spaceReclaimed);
        await loadQuotaStatus();
      }
    } catch (error) {
      console.error('Auto cleanup failed:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (isLoading || !quotaStatus) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">Loading storage information...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
          <CardDescription>
            Monitor and manage your GIF library storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used: {formatBytes(quotaStatus.used)}</span>
              <span>Total: {formatBytes(quotaStatus.total)}</span>
            </div>
            <Progress 
              value={quotaStatus.percentage} 
              className="h-2"
              style={{
                '--progress-background': getProgressColor(quotaStatus.percentage),
              } as React.CSSProperties}
            />
            <div className="flex justify-between text-sm">
              <span className={getStatusColor(quotaStatus.status)}>
                {quotaStatus.status.charAt(0).toUpperCase() + quotaStatus.status.slice(1)}
              </span>
              <span>{quotaStatus.percentage.toFixed(1)}% used</span>
            </div>
          </div>

          {quotaStatus.status !== 'healthy' && (
            <Alert>
              <AlertTitle>Storage {quotaStatus.status === 'critical' ? 'Critical' : 'Warning'}</AlertTitle>
              <AlertDescription>
                {quotaStatus.status === 'critical' 
                  ? 'Storage usage is above 90%. Please clean up old GIFs to free space.'
                  : 'Storage usage is above 80%. Consider cleaning up old GIFs.'}
              </AlertDescription>
            </Alert>
          )}

          {detailedUsage && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-sm">
                <div className="text-muted-foreground">Total GIFs</div>
                <div className="font-medium">{detailedUsage.totalGifs}</div>
              </div>
              <div className="text-sm">
                <div className="text-muted-foreground">Average Size</div>
                <div className="font-medium">{formatBytes(detailedUsage.averageSize)}</div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button 
            onClick={loadQuotaStatus} 
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            Refresh
          </Button>
          {suggestions.length > 0 && (
            <Button 
              onClick={() => setShowCleanupDialog(true)}
              variant={quotaStatus.status === 'critical' ? 'destructive' : 'default'}
              size="sm"
            >
              Clean Up ({suggestions.length} suggestions)
            </Button>
          )}
        </CardFooter>
      </Card>

      {showPolicySettings && (
        <Card>
          <CardHeader>
            <CardTitle>Cleanup Policy</CardTitle>
            <CardDescription>
              Configure automatic storage cleanup settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="auto-cleanup" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Enable auto-cleanup</label>
              <Switch
                id="auto-cleanup"
                checked={cleanupPolicy.enabled}
                onCheckedChange={(checked: boolean) => handleCleanupPolicyChange('enabled', checked)}
              />
            </div>
            
            {cleanupPolicy.enabled && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Trigger at {cleanupPolicy.thresholdPercentage}% capacity</label>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="5"
                    value={cleanupPolicy.thresholdPercentage}
                    onChange={(e) => handleCleanupPolicyChange('thresholdPercentage', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Clean up GIFs older than {cleanupPolicy.olderThanDays} days</label>
                  <input
                    type="range"
                    min="7"
                    max="90"
                    step="7"
                    value={cleanupPolicy.olderThanDays}
                    onChange={(e) => handleCleanupPolicyChange('olderThanDays', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label htmlFor="require-consent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Require user consent</label>
                  <Switch
                    id="require-consent"
                    checked={cleanupPolicy.requireUserConsent}
                    onCheckedChange={(checked: boolean) => handleCleanupPolicyChange('requireUserConsent', checked)}
                  />
                </div>
              </>
            )}
          </CardContent>
          {cleanupPolicy.enabled && (
            <CardFooter>
              <Button 
                onClick={handleAutoCleanup}
                variant="outline"
                size="sm"
                disabled={isCleaningUp || quotaStatus.percentage < cleanupPolicy.thresholdPercentage}
              >
                Run Cleanup Now
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Storage Cleanup</DialogTitle>
            <DialogDescription>
              Select which items to clean up to free storage space
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {suggestions.map((suggestion, index) => (
              <label key={index} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedSuggestions.has(index)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedSuggestions);
                    if (e.target.checked) {
                      newSelected.add(index);
                    } else {
                      newSelected.delete(index);
                    }
                    setSelectedSuggestions(newSelected);
                  }}
                />
                <div className="flex-1">
                  <div className="font-medium">{suggestion.description}</div>
                  <div className="text-sm text-muted-foreground">
                    Will free approximately {formatBytes(suggestion.estimatedSavings)}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCleanupDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCleanupSelected}
              disabled={selectedSuggestions.size === 0 || isCleaningUp}
            >
              {isCleaningUp ? 'Cleaning...' : `Clean Up (${selectedSuggestions.size} selected)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
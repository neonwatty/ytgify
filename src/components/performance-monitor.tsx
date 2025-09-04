import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';
import { performanceTracker, PerformanceSnapshot } from '@/monitoring/performance-tracker';
import { metricsCollector, CollectedMetrics } from '@/monitoring/metrics-collector';

interface PerformanceMonitorProps {
  className?: string;
  compact?: boolean;
  showRecommendations?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  className = '',
  compact = false,
  showRecommendations = true
}) => {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [metrics, setMetrics] = useState<CollectedMetrics | null>(null);
  const [userReport, setUserReport] = useState<ReturnType<typeof metricsCollector.generateUserReport> | null>(null);

  useEffect(() => {
    // Subscribe to performance updates
    const unsubscribePerformance = performanceTracker.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    // Subscribe to metrics updates
    const unsubscribeMetrics = metricsCollector.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setUserReport(metricsCollector.generateUserReport());
    });

    // Initial report
    setUserReport(metricsCollector.generateUserReport());

    return () => {
      unsubscribePerformance();
      unsubscribeMetrics();
    };
  }, []);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-500';
    if (value <= thresholds.warning) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (successRate: number) => {
    if (successRate >= 95) {
      return <Badge variant="default" className="bg-green-500">Excellent</Badge>;
    } else if (successRate >= 80) {
      return <Badge variant="default" className="bg-yellow-500">Good</Badge>;
    } else {
      return <Badge variant="destructive">Needs Attention</Badge>;
    }
  };

  if (compact && snapshot) {
    return (
      <div className={`flex items-center gap-4 p-2 rounded-lg bg-secondary/20 ${className}`}>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Performance</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${getStatusColor(snapshot.summary.averageFrameExtractionTime, { good: 50, warning: 100 })}`} />
          <span className="text-xs">{Math.round(snapshot.summary.averageFrameExtractionTime)}ms</span>
        </div>
        
        <div className="flex items-center gap-2">
          <HardDrive className={`h-4 w-4 ${getStatusColor(snapshot.summary.memoryUsage, { good: 200, warning: 400 })}`} />
          <span className="text-xs">{Math.round(snapshot.summary.memoryUsage)}MB</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Cpu className={`h-4 w-4 ${getStatusColor(snapshot.summary.cpuUsage, { good: 50, warning: 80 })}`} />
          <span className="text-xs">{snapshot.summary.cpuUsage}%</span>
        </div>
      </div>
    );
  }

  if (!snapshot || !metrics || !userReport) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Loading performance metrics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Monitor
          </span>
          {getStatusBadge(snapshot.summary.successRate)}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Message */}
        <div className="p-4 rounded-lg bg-secondary/20">
          <p className="text-sm font-medium">{userReport.summary}</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Frame Extraction</span>
            </div>
            <p className={`text-lg font-bold ${getStatusColor(snapshot.summary.averageFrameExtractionTime, { good: 50, warning: 100 })}`}>
              {Math.round(snapshot.summary.averageFrameExtractionTime)}ms
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Encoding Time</span>
            </div>
            <p className={`text-lg font-bold ${getStatusColor(snapshot.summary.averageEncodingTime, { good: 200, warning: 500 })}`}>
              {Math.round(snapshot.summary.averageEncodingTime)}ms
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Memory Usage</span>
            </div>
            <p className={`text-lg font-bold ${getStatusColor(snapshot.summary.memoryUsage, { good: 200, warning: 400 })}`}>
              {Math.round(snapshot.summary.memoryUsage)}MB
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">CPU Usage</span>
            </div>
            <Progress value={snapshot.summary.cpuUsage} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground">{snapshot.summary.cpuUsage}%</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Success Rate</span>
            </div>
            <Progress value={snapshot.summary.successRate} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground">{Math.round(snapshot.summary.successRate)}%</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Operations</span>
            </div>
            <p className="text-lg font-bold">{snapshot.summary.totalOperations}</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-sm font-medium">Session Statistics</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(userReport.stats).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {showRecommendations && userReport.recommendations.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Performance Recommendations:</p>
                <ul className="list-disc list-inside space-y-1">
                  {userReport.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Count */}
        {metrics.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {metrics.errors.length} error(s) occurred during this session.
              Latest: {metrics.errors[metrics.errors.length - 1].message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;
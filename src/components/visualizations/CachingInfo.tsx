'use client';

interface CachingInfoProps {
  workflow: any;
}

export default function CachingInfo({ workflow }: CachingInfoProps) {
  const cachingInfo = analyzeCaching(workflow);

  function analyzeCaching(workflow: any) {
    const info = {
      cachingUsed: false,
      cachingSteps: [] as any[],
      recommendations: [] as string[],
    };

    // Check if workflow has jobs
    if (!workflow.jobs) return info;

    // Analyze each job for caching
    Object.entries(workflow.jobs).forEach(([jobId, job]: [string, any]) => {
      if (!job.steps) return;

      job.steps.forEach((step: any, index: number) => {
        // Check for actions/cache
        if (step.uses && step.uses.startsWith('actions/cache@')) {
          info.cachingUsed = true;
          info.cachingSteps.push({
            jobId,
            step,
            index,
          });
        }

        // Check for setup-node with cache
        if (step.uses && step.uses.startsWith('actions/setup-node@') && step.with && step.with.cache) {
          info.cachingUsed = true;
          info.cachingSteps.push({
            jobId,
            step,
            index,
            type: 'setup-node',
          });
        }
      });
    });

    // Generate recommendations
    if (!info.cachingUsed) {
      info.recommendations.push('No caching detected. Consider adding caching to improve workflow performance.');

      // Check for common cacheable scenarios
      const hasNodeModules = JSON.stringify(workflow).includes('node_modules');
      if (hasNodeModules) {
        info.recommendations.push('Detected potential Node.js project. Consider caching node_modules with actions/cache or using setup-node with cache option.');
      }

      const hasPipPackages = JSON.stringify(workflow).includes('pip install');
      if (hasPipPackages) {
        info.recommendations.push('Detected pip install commands. Consider caching Python dependencies.');
      }
    } else {
      // Check for potential caching issues
      info.cachingSteps.forEach(({ jobId, step }) => {
        if (step.uses && step.uses.startsWith('actions/cache@')) {
          if (!step.with || !step.with.key) {
            info.recommendations.push(`Job "${jobId}" has a cache step without a key specified.`);
          } else if (!step.with.path) {
            info.recommendations.push(`Job "${jobId}" has a cache step without a path specified.`);
          } else if (!step.with.key.includes('${{ hashFiles')) {
            info.recommendations.push(`Job "${jobId}" cache key doesn't use hashFiles function, which may lead to stale caches.`);
          }
        }
      });
    }

    return info;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 border rounded-md overflow-auto p-4 bg-white">
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Cache Usage</h3>
          {cachingInfo.cachingUsed ? (
            <div className="text-green-600 bg-green-50 p-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Caching is being used in this workflow</span>
              </div>
            </div>
          ) : (
            <div className="text-yellow-600 bg-yellow-50 p-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>No caching detected in this workflow</span>
              </div>
            </div>
          )}
        </div>

        {cachingInfo.cachingSteps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Cache Steps</h3>
            <ul className="space-y-3">
              {cachingInfo.cachingSteps.map((cacheStep, index) => (
                <li key={index} className="border p-3 rounded-md">
                  <div className="font-medium">Job: {cacheStep.jobId}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {cacheStep.type === 'setup-node' ? (
                      <span>Using Node.js setup with caching: {cacheStep.step.with?.cache}</span>
                    ) : (
                      <>
                        <div>Action: {cacheStep.step.uses}</div>
                        {cacheStep.step.with?.path && <div>Path: {cacheStep.step.with.path}</div>}
                        {cacheStep.step.with?.key && <div>Key: {cacheStep.step.with.key}</div>}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-lg font-medium mb-2">Recommendations</h3>
          {cachingInfo.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {cachingInfo.recommendations.map((recommendation, index) => (
                <li key={index} className="bg-blue-50 p-3 rounded-md text-blue-700">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>{recommendation}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No specific recommendations for caching.</p>
          )}
        </div>
      </div>
    </div>
  );
}

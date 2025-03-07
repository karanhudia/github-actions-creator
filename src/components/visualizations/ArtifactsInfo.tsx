'use client';

interface ArtifactsInfoProps {
  workflow: any;
}

export default function ArtifactsInfo({ workflow }: ArtifactsInfoProps) {
  const artifactsInfo = analyzeArtifacts(workflow);

  function analyzeArtifacts(workflow: any) {
    const info = {
      uploads: [] as any[],
      downloads: [] as any[],
      recommendations: [] as string[],
    };

    // Check if workflow has jobs
    if (!workflow.jobs) return info;

    // Analyze each job for artifacts
    Object.entries(workflow.jobs).forEach(([jobId, job]: [string, any]) => {
      if (!job.steps) return;

      job.steps.forEach((step: any, index: number) => {
        // Check for upload-artifact
        if (step.uses && step.uses.startsWith('actions/upload-artifact@')) {
          info.uploads.push({
            jobId,
            step,
            index,
          });
        }
        
        // Check for download-artifact
        if (step.uses && step.uses.startsWith('actions/download-artifact@')) {
          info.downloads.push({
            jobId,
            step,
            index,
          });
        }
      });
    });

    // Generate recommendations
    if (info.uploads.length === 0 && info.downloads.length === 0) {
      info.recommendations.push('No artifacts are being used in this workflow. Consider using artifacts to share data between jobs if needed.');
    } else if (info.uploads.length > 0 && info.downloads.length === 0) {
      info.recommendations.push('Artifacts are being uploaded but never downloaded. Make sure this is intentional.');
    } else if (info.uploads.length === 0 && info.downloads.length > 0) {
      info.recommendations.push('Artifacts are being downloaded but never uploaded in this workflow. This might cause failures unless artifacts come from other workflows.');
    }

    // Check for potential artifact issues
    info.uploads.forEach(({ jobId, step }) => {
      if (!step.with || !step.with.name) {
        info.recommendations.push(`Job "${jobId}" has an upload-artifact step without a name specified.`);
      }
      if (!step.with || !step.with.path) {
        info.recommendations.push(`Job "${jobId}" has an upload-artifact step without a path specified.`);
      }
    });

    // Check for artifact retention
    const hasRetention = info.uploads.some(({ step }) => step.with && step.with['retention-days']);
    if (info.uploads.length > 0 && !hasRetention) {
      info.recommendations.push('Consider setting retention-days for artifacts to control storage usage.');
    }

    return info;
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Artifacts Information</h2>
      <div className="flex-1 border rounded-md overflow-auto p-4 bg-white">
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Artifact Usage</h3>
          {artifactsInfo.uploads.length > 0 || artifactsInfo.downloads.length > 0 ? (
            <div className="text-green-600 bg-green-50 p-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Artifacts are being used in this workflow</span>
              </div>
            </div>
          ) : (
            <div className="text-yellow-600 bg-yellow-50 p-3 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>No artifacts detected in this workflow</span>
              </div>
            </div>
          )}
        </div>

        {artifactsInfo.uploads.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Artifact Uploads</h3>
            <ul className="space-y-3">
              {artifactsInfo.uploads.map((upload, index) => (
                <li key={index} className="border p-3 rounded-md">
                  <div className="font-medium">Job: {upload.jobId}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Action: {upload.step.uses}</div>
                    {upload.step.with?.name && <div>Name: {upload.step.with.name}</div>}
                    {upload.step.with?.path && <div>Path: {upload.step.with.path}</div>}
                    {upload.step.with?.['retention-days'] && (
                      <div>Retention: {upload.step.with['retention-days']} days</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {artifactsInfo.downloads.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Artifact Downloads</h3>
            <ul className="space-y-3">
              {artifactsInfo.downloads.map((download, index) => (
                <li key={index} className="border p-3 rounded-md">
                  <div className="font-medium">Job: {download.jobId}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Action: {download.step.uses}</div>
                    {download.step.with?.name && <div>Name: {download.step.with.name}</div>}
                    {download.step.with?.path && <div>Path: {download.step.with.path}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-lg font-medium mb-2">Recommendations</h3>
          {artifactsInfo.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {artifactsInfo.recommendations.map((recommendation, index) => (
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
            <p className="text-gray-600">No specific recommendations for artifacts.</p>
          )}
        </div>
      </div>
    </div>
  );
} 
'use client';

interface ErrorCheckerProps {
  workflow: any;
  isDarkMode?: boolean;
}

export default function ErrorChecker({ workflow, isDarkMode = true }: ErrorCheckerProps) {
  const errors = checkForErrors(workflow);

  function checkForErrors(workflow: any) {
    const errors = [];

    // Check if workflow has jobs
    if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
      errors.push({
        type: 'error',
        message: 'Workflow has no jobs defined',
      });
    }

    // Check for circular dependencies
    const jobIds = Object.keys(workflow.jobs || {});
    const dependencyGraph: Record<string, string[]> = {};

    jobIds.forEach(jobId => {
      const job = workflow.jobs[jobId];
      dependencyGraph[jobId] = job.needs || [];
    });

    const circularDeps = findCircularDependencies(dependencyGraph);
    if (circularDeps.length > 0) {
      errors.push({
        type: 'error',
        message: `Circular dependencies detected: ${circularDeps.join(' → ')}`,
      });
    }

    // Check for references to non-existent jobs
    jobIds.forEach(jobId => {
      const job = workflow.jobs[jobId];
      if (job.needs) {
        job.needs.forEach((neededJob: string) => {
          if (!jobIds.includes(neededJob)) {
            errors.push({
              type: 'error',
              message: `Job "${jobId}" depends on non-existent job "${neededJob}"`,
            });
          }
        });
      }
    });

    // Check for invalid runner
    jobIds.forEach(jobId => {
      const job = workflow.jobs[jobId];
      if (job['runs-on']) {
        const runner = job['runs-on'];
        if (typeof runner === 'string' && !isValidRunner(runner)) {
          errors.push({
            type: 'warning',
            message: `Job "${jobId}" uses potentially invalid runner "${runner}"`,
          });
        }
      } else {
        errors.push({
          type: 'error',
          message: `Job "${jobId}" does not specify a runner (runs-on)`,
        });
      }
    });

    // Check for TODO comments
    const workflowStr = JSON.stringify(workflow);
    if (workflowStr.includes('TODO')) {
      errors.push({
        type: 'warning',
        message: 'Workflow contains TODO comments that should be addressed before using in production',
      });
    }

    // Check for hardcoded secrets
    if (workflowStr.includes('AKIA') || workflowStr.match(/([a-zA-Z0-9+/]{40}|[a-zA-Z0-9+/]{50,})/)) {
      errors.push({
        type: 'error',
        message: 'Workflow may contain hardcoded credentials or secrets. Use GitHub Secrets instead.',
      });
    }

    // Check for undefined variables
    const variableMatches = workflowStr.match(/\$\{\{\s*[^}]+\s*\}\}/g) || [];
    variableMatches.forEach(match => {
      const varName = match.replace(/\$\{\{\s*/, '').replace(/\s*\}\}/, '').trim();

      // Check for common variable types
      if (varName.startsWith('env.')) {
        const envVar = varName.substring(4);
        if (!workflow.env || !workflow.env[envVar]) {
          // Check if it's defined in a job
          let foundInJob = false;
          for (const jobId of jobIds) {
            if (workflow.jobs[jobId].env && workflow.jobs[jobId].env[envVar]) {
              foundInJob = true;
              break;
            }
          }

          if (!foundInJob) {
            errors.push({
              type: 'warning',
              message: `Environment variable "${envVar}" is used but might not be defined at the workflow level`,
            });
          }
        }
      } else if (varName.startsWith('vars.')) {
        errors.push({
          type: 'info',
          message: `Using repository variable "${varName.substring(5)}". Make sure it's defined in your repository settings.`,
        });
      } else if (varName.startsWith('secrets.')) {
        errors.push({
          type: 'info',
          message: `Using secret "${varName.substring(8)}". Make sure it's defined in your repository secrets.`,
        });
      }
    });

    return errors;
  }

  function findCircularDependencies(graph: Record<string, string[]>) {
    const visited = new Set();
    const path: string[] = [];
    const result: string[] = [];

    function dfs(node: string) {
      if (result.length > 0) return;
      if (path.includes(node)) {
        const cycle = [...path.slice(path.indexOf(node)), node];
        result.push(...cycle);
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      path.push(node);

      for (const neighbor of graph[node] || []) {
        dfs(neighbor);
      }

      path.pop();
    }

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return result;
  }

  function isValidRunner(runner: string) {
    const commonRunners = [
      'ubuntu-latest', 'ubuntu-22.04', 'ubuntu-20.04', 'ubuntu-18.04',
      'windows-latest', 'windows-2022', 'windows-2019',
      'macos-latest', 'macos-12', 'macos-11',
      'self-hosted'
    ];
    return commonRunners.includes(runner) || runner.startsWith('self-hosted');
  }

  return (
    <div className="h-full flex flex-col">
      <div className={`flex-1 border rounded-md overflow-auto p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {!workflow ? (
          <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>Paste a GitHub Actions workflow on the left to check for errors</p>
          </div>
        ) : errors.length === 0 ? (
          <div className={`flex items-center ${isDarkMode ? 'text-green-400 bg-green-900/20' : 'text-green-600 bg-green-50'} p-4 rounded-md`}>
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>No errors detected in the workflow</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li
                key={index}
                className={`p-3 rounded-md ${
                  error.type === 'error' 
                    ? isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-700'
                    : error.type === 'warning'
                      ? isDarkMode ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                      : isDarkMode ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'
                }`}
              >
                <div className="flex items-start">
                  {error.type === 'error' ? (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : error.type === 'warning' ? (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{error.message}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

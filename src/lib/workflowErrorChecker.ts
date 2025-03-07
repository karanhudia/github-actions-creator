export interface WorkflowError {
  type: 'error' | 'warning' | 'info';
  message: string;
}

/**
 * Checks a GitHub Actions workflow for common errors and issues
 * @param workflow The parsed workflow object
 * @returns Array of errors, warnings, and info messages
 */
export function checkWorkflowForErrors(workflow: any): WorkflowError[] {
  const errors: WorkflowError[] = [];

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

/**
 * Finds circular dependencies in a job dependency graph
 * @param graph Object mapping job IDs to arrays of job IDs they depend on
 * @returns Array containing the jobs in the circular dependency chain, or empty array if none found
 */
export function findCircularDependencies(graph: Record<string, string[]>): string[] {
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

/**
 * Checks if a runner string is a valid GitHub Actions runner
 * @param runner The runner string to check
 * @returns boolean indicating if the runner is valid
 */
export function isValidRunner(runner: string): boolean {
  const commonRunners = [
    'ubuntu-latest', 'ubuntu-22.04', 'ubuntu-20.04', 'ubuntu-18.04',
    'windows-latest', 'windows-2022', 'windows-2019',
    'macos-latest', 'macos-12', 'macos-11',
    'self-hosted'
  ];
  return commonRunners.includes(runner) || runner.startsWith('self-hosted');
} 
'use client';

interface SuggestionsProps {
  workflow: any;
}

export default function Suggestions({ workflow }: SuggestionsProps) {
  const suggestions = generateSuggestions(workflow);

  function generateSuggestions(workflow: any) {
    const allSuggestions = [] as { category: string; text: string }[];

    if (!workflow || !workflow.jobs) return allSuggestions;

    // Check for workflow name
    if (!workflow.name) {
      allSuggestions.push({
        category: 'Documentation',
        text: 'Add a name to your workflow for better identification in the GitHub UI.',
      });
    }

    // Check for workflow triggers
    if (!workflow.on) {
      allSuggestions.push({
        category: 'Triggers',
        text: 'No triggers defined. Your workflow will not run automatically.',
      });
    }

    // Check for job dependencies
    const jobsWithoutNeeds = Object.entries(workflow.jobs)
      .filter(([_, job]: [string, any]) => !job.needs || job.needs.length === 0)
      .map(([id]) => id);

    if (jobsWithoutNeeds.length > 1) {
      allSuggestions.push({
        category: 'Performance',
        text: `Multiple jobs (${jobsWithoutNeeds.join(', ')}) have no dependencies and will run in parallel. Make sure this is intentional.`,
      });
    }

    // Check for job timeouts
    const jobsWithoutTimeout = Object.entries(workflow.jobs)
      .filter(([_, job]: [string, any]) => !job.timeout_minutes)
      .map(([id]) => id);

    if (jobsWithoutTimeout.length > 0) {
      allSuggestions.push({
        category: 'Reliability',
        text: 'Consider adding timeout_minutes to jobs to prevent hung jobs from blocking your workflow.',
      });
    }

    // Check for continue-on-error
    const hasErrorHandling = Object.values(workflow.jobs).some(
      (job: any) => job['continue-on-error'] === true
    );

    if (!hasErrorHandling) {
      allSuggestions.push({
        category: 'Reliability',
        text: 'Consider using continue-on-error for non-critical jobs to make your workflow more resilient.',
      });
    }

    // Check for matrix builds
    const hasMatrix = Object.values(workflow.jobs).some(
      (job: any) => job.strategy && job.strategy.matrix
    );

    if (!hasMatrix) {
      allSuggestions.push({
        category: 'Efficiency',
        text: 'Consider using matrix builds to test across multiple configurations with a single job definition.',
      });
    }

    // Check for environment variables
    const hasEnv = workflow.env || Object.values(workflow.jobs).some((job: any) => job.env);

    if (!hasEnv) {
      allSuggestions.push({
        category: 'Configuration',
        text: 'Consider using environment variables to make your workflow more configurable and maintainable.',
      });
    }

    // Check for GitHub token usage
    const usesGitHubToken = JSON.stringify(workflow).includes('${{ secrets.GITHUB_TOKEN }}');

    if (!usesGitHubToken) {
      allSuggestions.push({
        category: 'Security',
        text: 'Consider using the built-in GITHUB_TOKEN for authentication instead of personal access tokens when possible.',
      });
    }

    return allSuggestions;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 border rounded-md overflow-auto p-4 bg-white">
        {suggestions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No suggestions available for this workflow</p>
          </div>
        ) : (
          <div className="space-y-6">
            {['Performance', 'Reliability', 'Security', 'Efficiency', 'Configuration', 'Documentation', 'Triggers'].map(category => {
              const categorySuggestions = suggestions.filter(s => s.category === category);
              if (categorySuggestions.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-lg font-medium mb-3">{category}</h3>
                  <ul className="space-y-2">
                    {categorySuggestions.map((suggestion, index) => (
                      <li key={index} className="bg-blue-50 p-3 rounded-md text-blue-700">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span>{suggestion.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

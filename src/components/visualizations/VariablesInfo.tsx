'use client';

import { useState } from 'react';

interface VariablesInfoProps {
  workflow: any;
}

export default function VariablesInfo({ workflow }: VariablesInfoProps) {
  const [selectedStep, setSelectedStep] = useState<{
    jobId: string;
    stepIndex: number;
    name: string;
    variables: any[];
  } | null>(null);

  const variablesInfo = analyzeVariables(workflow);

  function analyzeVariables(workflow: any) {
    const info = {
      envVars: [] as { scope: string; name: string; value: any; jobId?: string; stepIndex?: number }[],
      expressions: [] as { location: string; expression: string; type: string; jobId?: string; stepIndex?: number; predictedValue?: string }[],
      secrets: [] as string[],
      repoVars: [] as string[],
      githubContext: [] as string[],
      steps: [] as { jobId: string; stepIndex: number; name: string; variables: any[] }[],
    };

    if (!workflow) return info;

    // Check workflow-level env vars
    if (workflow.env) {
      Object.entries(workflow.env).forEach(([name, value]) => {
        info.envVars.push({
          scope: 'workflow',
          name,
          value,
        });
      });
    }

    // Check job-level env vars and expressions
    if (workflow.jobs) {
      Object.entries(workflow.jobs).forEach(([jobId, job]: [string, any]) => {
        // Job env vars
        if (job.env) {
          Object.entries(job.env).forEach(([name, value]) => {
            info.envVars.push({
              scope: `job:${jobId}`,
              name,
              value,
              jobId,
            });
          });
        }

        // Step env vars and expressions
        if (job.steps) {
          job.steps.forEach((step: any, stepIndex: number) => {
            const stepVariables: any[] = [];

            if (step.env) {
              Object.entries(step.env).forEach(([name, value]) => {
                info.envVars.push({
                  scope: `job:${jobId}:step:${stepIndex + 1}`,
                  name,
                  value,
                  jobId,
                  stepIndex,
                });

                stepVariables.push({
                  type: 'env',
                  name,
                  value,
                });
              });
            }

            // Analyze step content for expressions
            const stepStr = JSON.stringify(step);
            const expressionMatches = stepStr.match(/\$\{\{\s*([^}]+)\s*\}\}/g) || [];

            expressionMatches.forEach(match => {
              const expression = match.replace(/\$\{\{\s*/, '').replace(/\s*\}\}/, '').trim();
              let type = 'unknown';
              let predictedValue = 'Unknown';

              if (expression.startsWith('env.')) {
                type = 'environment';
                const envVar = expression.substring(4);

                // Try to predict the value
                const envVarDef = info.envVars.find(v => v.name === envVar);
                if (envVarDef) {
                  predictedValue = String(envVarDef.value);
                }

                stepVariables.push({
                  type: 'expression',
                  subtype: 'env',
                  expression,
                  predictedValue,
                });
              } else if (expression.startsWith('secrets.')) {
                type = 'secret';
                const secretName = expression.substring(8);
                if (!info.secrets.includes(secretName)) {
                  info.secrets.push(secretName);
                }

                predictedValue = '****** (secret)';

                stepVariables.push({
                  type: 'expression',
                  subtype: 'secret',
                  expression,
                  predictedValue,
                });
              } else if (expression.startsWith('vars.')) {
                type = 'repository variable';
                const varName = expression.substring(5);
                if (!info.repoVars.includes(varName)) {
                  info.repoVars.push(varName);
                }

                predictedValue = `Repository variable: ${varName}`;

                stepVariables.push({
                  type: 'expression',
                  subtype: 'repository variable',
                  expression,
                  predictedValue,
                });
              } else if (expression.startsWith('github.')) {
                type = 'github context';
                const contextVar = expression.substring(7);
                if (!info.githubContext.includes(contextVar)) {
                  info.githubContext.push(contextVar);
                }

                // Predict common GitHub context values
                switch (contextVar) {
                  case 'sha':
                    predictedValue = '8f142c22a0c1e5a5f35b232974cabf45d66f7f1a';
                    break;
                  case 'ref':
                    predictedValue = 'refs/heads/main';
                    break;
                  case 'event_name':
                    predictedValue = 'push';
                    break;
                  case 'workflow':
                    predictedValue = workflow.name || 'Workflow';
                    break;
                  case 'run_number':
                    predictedValue = '42';
                    break;
                  case 'actor':
                    predictedValue = 'octocat';
                    break;
                  case 'repository':
                    predictedValue = 'owner/repo';
                    break;
                  default:
                    predictedValue = `GitHub context: ${contextVar}`;
                }

                stepVariables.push({
                  type: 'expression',
                  subtype: 'github context',
                  expression,
                  predictedValue,
                });
              } else if (expression.match(/^[A-Z_]+$/)) {
                // Looks like a GitHub environment variable
                type = 'github env';

                // Predict common GitHub env values
                switch (expression) {
                  case 'GITHUB_SHA':
                    predictedValue = '8f142c22a0c1e5a5f35b232974cabf45d66f7f1a';
                    break;
                  case 'GITHUB_REF':
                    predictedValue = 'refs/heads/main';
                    break;
                  case 'GITHUB_WORKSPACE':
                    predictedValue = '/home/runner/work/repo/repo';
                    break;
                  case 'GITHUB_ENV':
                    predictedValue = '/home/runner/work/_temp/_runner_file_commands/set_env_123456789';
                    break;
                  case 'GITHUB_RUN_NUMBER':
                    predictedValue = '42';
                    break;
                  default:
                    predictedValue = `GitHub env: ${expression}`;
                }

                stepVariables.push({
                  type: 'expression',
                  subtype: 'github env',
                  expression,
                  predictedValue,
                });
              }

              info.expressions.push({
                location: `job:${jobId}:step:${stepIndex + 1}`,
                expression,
                type,
                jobId,
                stepIndex,
                predictedValue,
              });
            });

            // Special handling for commands that modify environment variables
            if (step.run) {
              const runCommand = String(step.run);

              // Check for environment variable exports
              const exportMatches = runCommand.match(/export\s+([A-Z_]+)=(.+)$/gm) || [];
              exportMatches.forEach(match => {
                const parts = match.split('=');
                if (parts.length >= 2) {
                  const name = parts[0].replace('export', '').trim();
                  const value = parts.slice(1).join('=').trim();

                  stepVariables.push({
                    type: 'export',
                    name,
                    value,
                    note: 'Sets environment variable for this step only',
                  });
                }
              });

              // Check for GITHUB_ENV modifications
              const envFileMatches = runCommand.match(/echo\s+["']?([^"'\s]+)=([^"'\s]+)["']?\s*>>\s*\${?GITHUB_ENV}?/g) || [];
              envFileMatches.forEach(match => {
                const parts = match.match(/echo\s+["']?([^"'\s]+)=([^"'\s]+)["']?/);
                if (parts && parts.length >= 3) {
                  const name = parts[1];
                  const value = parts[2];

                  stepVariables.push({
                    type: 'github_env',
                    name,
                    value,
                    note: 'Sets environment variable for all subsequent steps',
                  });
                }
              });
            }

            if (stepVariables.length > 0) {
              info.steps.push({
                jobId,
                stepIndex,
                name: step.name || `Step ${stepIndex + 1}`,
                variables: stepVariables,
              });
            }
          });
        }
      });
    }

    return info;
  }

  return (
    <div className="h-full flex flex-col">
      {/* This div constrains the height and prevents page scrolling */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Main content with scrolling */}
          <div className={`${selectedStep ? 'w-2/3' : 'w-full'} h-full overflow-auto pr-4`}>
            <div className="space-y-6 pb-4">
              {/* Environment Variables */}
              <div>
                <h3 className="text-lg font-medium mb-3">Environment Variables</h3>
                {variablesInfo.envVars.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {variablesInfo.envVars.map((env, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{env.scope}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{env.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{String(env.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No environment variables defined in this workflow.</p>
                )}
              </div>

              {/* Steps with Variables */}
              <div>
                <h3 className="text-lg font-medium mb-3">Steps with Variables</h3>
                {variablesInfo.steps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {variablesInfo.steps.map((step, index) => (
                      <div
                        key={index}
                        className={`border rounded-md p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors ${
                          selectedStep && selectedStep.jobId === step.jobId && selectedStep.stepIndex === step.stepIndex 
                            ? 'bg-blue-50 border-blue-300' 
                            : 'bg-white'
                        }`}
                        onClick={() => setSelectedStep(step)}
                      >
                        <div className="font-medium text-gray-900 mb-2">{step.name}</div>
                        <div className="text-sm text-gray-500">Job: {step.jobId}</div>
                        <div className="text-sm text-gray-500 mt-2">
                          Uses {step.variables.length} variable{step.variables.length !== 1 ? 's' : ''}
                        </div>
                        <div className="mt-2 text-xs text-blue-600">Click for details</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No steps with variables found in this workflow.</p>
                )}
              </div>

              {/* Expressions */}
              <div>
                <h3 className="text-lg font-medium mb-3">Expressions</h3>
                {variablesInfo.expressions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expression</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Predicted Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {variablesInfo.expressions.map((expr, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expr.location}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expr.expression}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expr.type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expr.predictedValue || 'Unknown'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No expressions found in this workflow.</p>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Secrets */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2">Secrets Used</h4>
                  {variablesInfo.secrets.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {variablesInfo.secrets.map((secret, index) => (
                        <li key={index}>{secret}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No secrets used</p>
                  )}
                </div>

                {/* Repository Variables */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2">Repository Variables</h4>
                  {variablesInfo.repoVars.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {variablesInfo.repoVars.map((variable, index) => (
                        <li key={index}>{variable}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No repository variables used</p>
                  )}
                </div>

                {/* GitHub Context */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2">GitHub Context</h4>
                  {variablesInfo.githubContext.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {variablesInfo.githubContext.map((context, index) => (
                        <li key={index}>{context}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No GitHub context variables used</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side panel for step details */}
          {selectedStep && (
            <div className="w-1/3 h-full overflow-auto border-l pl-4">
              <div className="sticky top-0 bg-white pb-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Step Details</h3>
                  <button
                    onClick={() => setSelectedStep(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  <div><span className="font-medium">Name:</span> {selectedStep.name}</div>
                  <div><span className="font-medium">Job:</span> {selectedStep.jobId}</div>
                  <div><span className="font-medium">Step Index:</span> {selectedStep.stepIndex + 1}</div>
                </div>
              </div>

              <div className="mt-4 space-y-4 pb-4">
                <h4 className="font-medium text-gray-700">Variables Used</h4>

                {selectedStep.variables.length > 0 ? (
                  selectedStep.variables.map((variable, index) => (
                    <div key={index} className="border rounded-md p-3 bg-gray-50">
                      {variable.type === 'expression' && (
                        <>
                          <div className="font-medium text-gray-900">
                            ${'{{'} {variable.expression} {'}}'}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Type:</span> {variable.subtype}
                          </div>
                          <div className="text-sm text-gray-500">
                            <span className="font-medium">Predicted Value:</span> {variable.predictedValue}
                          </div>
                        </>
                      )}

                      {variable.type === 'env' && (
                        <>
                          <div className="font-medium text-gray-900">
                            env.{variable.name}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Value:</span> {variable.value}
                          </div>
                        </>
                      )}

                      {variable.type === 'export' && (
                        <>
                          <div className="font-medium text-gray-900">
                            export {variable.name}={variable.value}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Note:</span> {variable.note}
                          </div>
                        </>
                      )}

                      {variable.type === 'github_env' && (
                        <>
                          <div className="font-medium text-gray-900">
                            {variable.name}={variable.value} {'>'}{'>'}$GITHUB_ENV
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Note:</span> {variable.note}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No variables used in this step.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

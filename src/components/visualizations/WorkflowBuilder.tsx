'use client';

import {useEffect, useRef, useState} from 'react';

interface WorkflowBuilderProps {
  workflow: any;
  onGenerateCode: (code: string) => void;
  initialCode: string;
}

export default function WorkflowBuilder({ workflow, onGenerateCode, initialCode }: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || '');
  const [trigger, setTrigger] = useState('push');
  const [jobName, setJobName] = useState('build');
  const [runsOn, setRunsOn] = useState('ubuntu-latest');
  const [steps, setSteps] = useState([
    { name: 'Checkout code', uses: 'actions/checkout@v3' },
  ]);

  // Use a ref to track if we've initialized from the workflow
  const initializedRef = useRef(false);
  // Use a ref to track if we need to generate code
  const pendingGenerateRef = useRef(false);
  // Use a ref to prevent initial code generation
  const isFirstRenderRef = useRef(true);

  // Initialize from existing workflow if available
  useEffect(() => {
    if (workflow && !initializedRef.current) {
      initializedRef.current = true;

      setName(workflow.name || '');

      // Set trigger
      if (workflow.on) {
        if (typeof workflow.on === 'string') {
          setTrigger(workflow.on);
        } else if (Array.isArray(workflow.on)) {
          setTrigger(workflow.on[0] || 'push');
        } else if (typeof workflow.on === 'object') {
          setTrigger(Object.keys(workflow.on)[0] || 'push');
        }
      }

      // Set job info
      if (workflow.jobs) {
        const firstJobKey = Object.keys(workflow.jobs)[0];
        if (firstJobKey) {
          setJobName(firstJobKey);
          const job = workflow.jobs[firstJobKey];
          if (job['runs-on']) {
            setRunsOn(job['runs-on']);
          }

          // Set steps
          if (job.steps && Array.isArray(job.steps)) {
            const formattedSteps = job.steps.map((step: any) => {
              const formattedStep: any = { name: step.name || '' };
              if (step.uses) {
                formattedStep.uses = step.uses;
                if (step.with) {
                  formattedStep.with = step.with;
                }
              } else if (step.run) {
                formattedStep.run = step.run;
              }
              return formattedStep;
            });
            setSteps(formattedSteps.length > 0 ? formattedSteps : [{ name: 'Checkout code', uses: 'actions/checkout@v3' }]);
          }
        }
      }
    }
  }, [workflow]);

  // Mark that we need to generate code when values change
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    pendingGenerateRef.current = true;
  }, [name, trigger, jobName, runsOn, steps]);

  const handleAddStep = () => {
    setSteps([...steps, { name: '', run: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <p className="mb-4 text-sm text-gray-400">
        Build your GitHub Actions workflow using the form below
      </p>

      <div className="flex-1 overflow-auto">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Workflow Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="trigger" className="block text-sm font-medium text-gray-300 mb-1">
              Trigger
            </label>
            <select
              id="trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="push">push</option>
              <option value="pull_request">pull_request</option>
              <option value="workflow_dispatch">workflow_dispatch</option>
              <option value="schedule">schedule</option>
            </select>
          </div>

          <div>
            <label htmlFor="jobName" className="block text-sm font-medium text-gray-300 mb-1">
              Job Name
            </label>
            <input
              type="text"
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="build"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="runsOn" className="block text-sm font-medium text-gray-300 mb-1">
              Runs On
            </label>
            <select
              id="runsOn"
              value={runsOn}
              onChange={(e) => setRunsOn(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ubuntu-latest">ubuntu-latest</option>
              <option value="windows-latest">windows-latest</option>
              <option value="macos-latest">macos-latest</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">Steps</label>
              <button
                type="button"
                onClick={handleAddStep}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border border-gray-600 rounded-md p-4 bg-gray-800">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-white">Step {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(index)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                      placeholder="Step name"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={step.uses || ''}
                        onChange={(e) => handleStepChange(index, 'uses', e.target.value)}
                        placeholder="actions/checkout@v3"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={step.run || ''}
                        onChange={(e) => handleStepChange(index, 'run', e.target.value)}
                        placeholder="npm install"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {step.uses && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-medium text-gray-300">With</label>
                        </div>
                        <input
                          type="text"
                          value={step.with?.['node-version'] || ''}
                          onChange={(e) =>
                            handleStepChange(index, 'with', { 'node-version': e.target.value })
                          }
                          placeholder="Parameter (e.g. node-version: 16)"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import CodeEditor from '@/components/CodeEditor';
import VisualizationTabs from '@/components/VisualizationTabs';
import { parseWorkflow } from '@/lib/workflowParser';

export default function Home() {
  const [workflowCode, setWorkflowCode] = useState('');
  const [parsedWorkflow, setParsedWorkflow] = useState(null);

  const handleCodeChange = (code: string) => {
    setWorkflowCode(code);
    try {
      const parsed = parseWorkflow(code);
      setParsedWorkflow(parsed);
    } catch (error) {
      console.error('Error parsing workflow:', error);
      setParsedWorkflow(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold">GitHub Actions Visualizer</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 p-4 border-r">
          <CodeEditor code={workflowCode} onChange={handleCodeChange} />
        </div>
        <div className="w-1/2 p-4">
          <VisualizationTabs workflow={parsedWorkflow} />
        </div>
      </div>
    </main>
  );
}

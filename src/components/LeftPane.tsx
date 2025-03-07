'use client';

import { useState } from 'react';
import CodeEditor from '@/components/CodeEditor';
import WorkflowBuilder from '@/components/visualizations/WorkflowBuilder';
import { useTheme } from '@/context/ThemeContext';

interface LeftPaneProps {
  workflowCode: string;
  parsedWorkflow: any;
  onCodeChange: (code: string) => void;
  onGeneratedCodeChange: (code: string) => void;
}

export default function LeftPane({ 
  workflowCode, 
  parsedWorkflow, 
  onCodeChange, 
  onGeneratedCodeChange 
}: LeftPaneProps) {
  const [mode, setMode] = useState<'editor' | 'builder'>('editor');
  const { isDarkMode } = useTheme();

  return (
    <div className="h-full flex flex-col">
      <div className={`mb-4 flex border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setMode('editor')}
          className={`px-4 py-2 text-sm font-medium ${
            mode === 'editor'
              ? isDarkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'
              : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Code Editor
        </button>
        <button
          onClick={() => setMode('builder')}
          className={`px-4 py-2 text-sm font-medium ${
            mode === 'builder'
              ? isDarkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'
              : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Workflow Builder
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === 'editor' ? (
          <CodeEditor 
            code={workflowCode} 
            onChange={onCodeChange} 
          />
        ) : (
          <WorkflowBuilder 
            workflow={parsedWorkflow} 
            onGenerateCode={onGeneratedCodeChange} 
            initialCode={workflowCode}
          />
        )}
      </div>
    </div>
  );
} 
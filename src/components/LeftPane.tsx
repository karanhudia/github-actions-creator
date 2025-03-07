'use client';

import {useState} from 'react';
import CodeEditor from '@/components/CodeEditor';
import {useTheme} from '@/context/ThemeContext';

interface LeftPaneProps {
  workflowCode: string;
  parsedWorkflow: any;
  onCodeChange: (code: string) => void;
  onGeneratedCodeChange: (code: string) => void;
}

export default function LeftPane({
  workflowCode,
  onCodeChange,
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
              ? `${isDarkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'}`
              : `${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`
          }`}
        >
          YAML Editor
        </button>
        <button
          disabled
          className={`px-4 py-2 text-sm font-medium cursor-not-allowed opacity-50 ${
            isDarkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
          title="Workflow Builder is coming soon"
        >
          Visual Builder (Coming Soon)
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === 'editor' ? (
          <CodeEditor
            code={workflowCode}
            onChange={onCodeChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md p-8">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-medium mb-2">Workflow Builder Coming Soon</h3>
              <p className="text-gray-500 mb-4">We're working on a visual workflow builder to make creating GitHub Actions workflows even easier.</p>
              <button
                onClick={() => setMode('editor')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Return to Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

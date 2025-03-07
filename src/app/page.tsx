'use client';

import {useState} from 'react';
import LeftPane from '@/components/LeftPane';
import VisualizationTabs from '@/components/VisualizationTabs';
import {parseWorkflow} from '@/lib/workflowParser';
import {useTheme} from '@/context/ThemeContext';

export default function Home() {
  const [workflowCode, setWorkflowCode] = useState('');
  const [parsedWorkflow, setParsedWorkflow] = useState(null);
  const { isDarkMode, toggleDarkMode } = useTheme();

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

  const handleGeneratedCodeChange = (code: string) => {
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
    <main className={`flex min-h-screen flex-col ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <header className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} p-4 flex justify-between items-center`}>
        <h1 className="text-2xl font-bold">GitHub Actions Visualizer</h1>
        <button
          onClick={toggleDarkMode}
          className={`px-3 py-1 rounded-md ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`w-1/2 p-4 border-r ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <LeftPane
            workflowCode={workflowCode}
            parsedWorkflow={parsedWorkflow}
            onCodeChange={handleCodeChange}
            onGeneratedCodeChange={handleGeneratedCodeChange}
          />
        </div>
        <div className={`w-1/2 p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          <VisualizationTabs workflow={parsedWorkflow} />
        </div>
      </div>
    </main>
  );
}

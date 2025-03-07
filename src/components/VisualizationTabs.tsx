'use client';

import { useState } from 'react';
import WorkflowGraph from './visualizations/WorkflowGraph';
import ErrorChecker from './visualizations/ErrorChecker';
import CachingInfo from './visualizations/CachingInfo';
import ArtifactsInfo from './visualizations/ArtifactsInfo';
import Suggestions from './visualizations/Suggestions';
import VariablesInfo from './visualizations/VariablesInfo';
import { useTheme } from '@/context/ThemeContext';

interface VisualizationTabsProps {
  workflow: any;
}

export default function VisualizationTabs({ workflow }: VisualizationTabsProps) {
  const [activeTab, setActiveTab] = useState('graph');
  const { isDarkMode } = useTheme();

  const tabs = [
    { id: 'graph', label: 'Workflow Graph' },
    { id: 'errors', label: 'Error Checker' },
    { id: 'variables', label: 'Variables' },
    { id: 'caching', label: 'Caching Info' },
    { id: 'artifacts', label: 'Artifacts Info' },
    { id: 'suggestions', label: 'Suggestions' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? isDarkMode ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'graph' && <WorkflowGraph workflow={workflow} />}
        {activeTab === 'errors' && <ErrorChecker workflow={workflow} />}
        {activeTab === 'variables' && <VariablesInfo workflow={workflow} />}
        {activeTab === 'caching' && <CachingInfo workflow={workflow} />}
        {activeTab === 'artifacts' && <ArtifactsInfo workflow={workflow} />}
        {activeTab === 'suggestions' && <Suggestions workflow={workflow} />}
      </div>
    </div>
  );
} 
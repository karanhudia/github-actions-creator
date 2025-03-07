'use client';

import { useState } from 'react';
import WorkflowGraph from './visualizations/WorkflowGraph';
import ErrorChecker from './visualizations/ErrorChecker';
import CachingInfo from './visualizations/CachingInfo';
import ArtifactsInfo from './visualizations/ArtifactsInfo';
import Suggestions from './visualizations/Suggestions';
import WorkflowBuilder from './visualizations/WorkflowBuilder';
import VariablesInfo from './visualizations/VariablesInfo';

interface VisualizationTabsProps {
  workflow: any;
}

export default function VisualizationTabs({ workflow }: VisualizationTabsProps) {
  const [activeTab, setActiveTab] = useState('graph');

  const tabs = [
    { id: 'graph', label: 'Workflow Graph' },
    { id: 'errors', label: 'Error Checker' },
    { id: 'variables', label: 'Variables' },
    { id: 'caching', label: 'Caching Info' },
    { id: 'artifacts', label: 'Artifacts Info' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'builder', label: 'Workflow Builder' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
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
        {activeTab === 'builder' && <WorkflowBuilder workflow={workflow} />}
      </div>
    </div>
  );
} 
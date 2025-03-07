'use client';

import { checkWorkflowForErrors } from '@/lib/workflowErrorChecker';

interface ErrorCheckerProps {
  workflow: any;
  isDarkMode?: boolean;
}

export default function ErrorChecker({ workflow, isDarkMode = true }: ErrorCheckerProps) {
  const errors = checkWorkflowForErrors(workflow);

  return (
    <div className="h-full flex flex-col">
      <div className={`flex-1 border rounded-md overflow-auto p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        {!workflow ? (
          <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>Paste a GitHub Actions workflow on the left to check for errors</p>
          </div>
        ) : errors.length === 0 ? (
          <div className={`flex items-center ${isDarkMode ? 'text-green-400 bg-green-900/20' : 'text-green-600 bg-green-50'} p-4 rounded-md`}>
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>No errors detected in the workflow</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li
                key={index}
                className={`p-3 rounded-md ${
                  error.type === 'error' 
                    ? isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-700'
                    : error.type === 'warning'
                      ? isDarkMode ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700'
                      : isDarkMode ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'
                }`}
              >
                <div className="flex items-start">
                  {error.type === 'error' ? (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : error.type === 'warning' ? (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{error.message}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

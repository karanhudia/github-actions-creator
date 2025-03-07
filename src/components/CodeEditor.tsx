'use client';

import { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { useTheme } from '@/context/ThemeContext';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export default function CodeEditor({ code, onChange }: CodeEditorProps) {
  const [value, setValue] = useState(code || '');
  const { isDarkMode } = useTheme();

  useEffect(() => {
    setValue(code);
  }, [code]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setValue(value);
      onChange(value);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <p className={`mb-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Paste your GitHub Actions workflow YAML here
      </p>
      <div className={`flex-1 border rounded-md overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={value}
          onChange={handleEditorChange}
          theme={isDarkMode ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
          }}
        />
      </div>
    </div>
  );
}

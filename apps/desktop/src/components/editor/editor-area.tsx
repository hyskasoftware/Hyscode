import { useState } from 'react';
import { EditorTabs } from './editor-tabs';
import { EditorWelcome } from './editor-welcome';

export function EditorArea() {
  const [activeTab, setActiveTab] = useState('1');

  return (
    <div className="flex h-full flex-col">
      <EditorTabs activeTab={activeTab} onSelect={setActiveTab} />
      <EditorWelcome />
    </div>
  );
}

// React snippets registered as Monaco completion items
// Covers the most-used React / JSX patterns for TypeScript and JavaScript.

export interface MonacoSnippet {
  label: string;
  detail: string;
  insertText: string;
  kind: number; // CompletionItemKind
}

export const REACT_SNIPPETS: MonacoSnippet[] = [
  // Components
  {
    label: 'rfc',
    detail: 'React Functional Component',
    insertText: [
      'export function ${1:${TM_FILENAME_BASE}}({ $2 }) {',
      '  return (',
      '    <div>',
      '      $0',
      '    </div>',
      '  );',
      '}',
    ].join('\n'),
    kind: 15, // Snippet
  },
  {
    label: 'rafc',
    detail: 'React Arrow Function Component',
    insertText: [
      'export const ${1:${TM_FILENAME_BASE}} = ({ $2 }) => {',
      '  return (',
      '    <div>',
      '      $0',
      '    </div>',
      '  );',
      '};',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'rfce',
    detail: 'React Default Export Component',
    insertText: [
      'function ${1:${TM_FILENAME_BASE}}({ $2 }) {',
      '  return (',
      '    <div>',
      '      $0',
      '    </div>',
      '  );',
      '}',
      '',
      'export default ${1:${TM_FILENAME_BASE}};',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'rmemo',
    detail: 'React.memo Component',
    insertText: [
      "import { memo } from 'react';",
      '',
      'export const ${1:${TM_FILENAME_BASE}} = memo(function ${1:${TM_FILENAME_BASE}}({ $2 }) {',
      '  return (',
      '    <div>',
      '      $0',
      '    </div>',
      '  );',
      '});',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'rfref',
    detail: 'React forwardRef Component',
    insertText: [
      "import { forwardRef } from 'react';",
      '',
      'export const ${1:${TM_FILENAME_BASE}} = forwardRef(function ${1:${TM_FILENAME_BASE}}({ $2 }, ref) {',
      '  return (',
      '    <div ref={ref}>',
      '      $0',
      '    </div>',
      '  );',
      '});',
    ].join('\n'),
    kind: 15,
  },

  // Hooks
  {
    label: 'us',
    detail: 'useState',
    insertText: "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:''});",
    kind: 15,
  },
  {
    label: 'ue',
    detail: 'useEffect',
    insertText: [
      'useEffect(() => {',
      '  $0',
      '}, [${1}]);',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'uec',
    detail: 'useEffect with Cleanup',
    insertText: [
      'useEffect(() => {',
      '  $1',
      '',
      '  return () => {',
      '    $0',
      '  };',
      '}, [${2}]);',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'ur',
    detail: 'useRef',
    insertText: 'const ${1:ref} = useRef(${2:null});',
    kind: 15,
  },
  {
    label: 'um',
    detail: 'useMemo',
    insertText: [
      'const ${1:memoized} = useMemo(() => {',
      '  return $0;',
      '}, [${2}]);',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'ucb',
    detail: 'useCallback',
    insertText: [
      'const ${1:callback} = useCallback(($2) => {',
      '  $0',
      '}, [${3}]);',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'uc',
    detail: 'useContext',
    insertText: 'const ${1:value} = useContext(${2:MyContext});',
    kind: 15,
  },
  {
    label: 'urd',
    detail: 'useReducer',
    insertText: "const [${1:state}, dispatch] = useReducer(${2:reducer}, ${3:initialState});",
    kind: 15,
  },
  {
    label: 'uid',
    detail: 'useId',
    insertText: 'const ${1:id} = useId();',
    kind: 15,
  },
  {
    label: 'utr',
    detail: 'useTransition',
    insertText: 'const [isPending, startTransition] = useTransition();',
    kind: 15,
  },
  {
    label: 'udv',
    detail: 'useDeferredValue',
    insertText: 'const ${1:deferredValue} = useDeferredValue(${2:value});',
    kind: 15,
  },

  // JSX
  {
    label: 'frag',
    detail: 'React Fragment',
    insertText: [
      '<>',
      '  $0',
      '</>',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'jcond',
    detail: 'JSX Conditional Render',
    insertText: [
      '{${1:condition} && (',
      '  $0',
      ')}',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'jtern',
    detail: 'JSX Ternary',
    insertText: [
      '{${1:condition} ? (',
      '  ${2:trueElement}',
      ') : (',
      '  ${3:falseElement}',
      ')}',
    ].join('\n'),
    kind: 15,
  },
  {
    label: 'jmap',
    detail: 'JSX Map Render',
    insertText: [
      '{${1:items}.map((${2:item}) => (',
      '  <${3:div} key={${2:item}.${4:id}}>',
      '    $0',
      '  </${3:div}>',
      '))}',
    ].join('\n'),
    kind: 15,
  },

  // Imports
  {
    label: 'imr',
    detail: "Import from 'react'",
    insertText: "import { ${1:useState} } from 'react';",
    kind: 15,
  },
  {
    label: 'ims',
    detail: 'Import useState',
    insertText: "import { useState } from 'react';",
    kind: 15,
  },
  {
    label: 'ime',
    detail: 'Import useEffect',
    insertText: "import { useEffect } from 'react';",
    kind: 15,
  },
  {
    label: 'imse',
    detail: 'Import useState and useEffect',
    insertText: "import { useState, useEffect } from 'react';",
    kind: 15,
  },

  // Context
  {
    label: 'rctx',
    detail: 'React Context',
    insertText: [
      "import { createContext, useContext } from 'react';",
      '',
      'const ${1:MyContext} = createContext(${2:null});',
      '',
      'export function ${1:MyContext}Provider({ children }) {',
      '  const value = ${3:{}};',
      '',
      '  return (',
      '    <${1:MyContext}.Provider value={value}>',
      '      {children}',
      '    </${1:MyContext}.Provider>',
      '  );',
      '}',
      '',
      'export function use${1}() {',
      '  const context = useContext(${1:MyContext});',
      "  if (!context) { throw new Error('use${1} must be used within a ${1:MyContext}Provider'); }",
      '  return context;',
      '}',
      '$0',
    ].join('\n'),
    kind: 15,
  },

  // Utilities
  {
    label: 'clg',
    detail: 'console.log',
    insertText: "console.log('${1:label}:', ${2:value});",
    kind: 15,
  },
  {
    label: 'clv',
    detail: 'console.log variable',
    insertText: 'console.log({ ${1:variable} });',
    kind: 15,
  },
];

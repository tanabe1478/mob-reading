import Editor, { OnMount } from '@monaco-editor/react';
import { editor as MonacoEditor, Range } from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

export interface HighlightRange {
  id: string;
  startLine: number;
  endLine: number;
  label?: string;
}

export interface CodeEditorProps {
  path: string;
  content: string;
  highlights?: HighlightRange[];
  readOnly?: boolean;
  onSelectionChange?: (range: { startLine: number; endLine: number }) => void;
}

const guessLanguage = (path: string): string | undefined => {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  return undefined;
};

export function CodeEditor({
  path,
  content,
  highlights = [],
  readOnly = true,
  onSelectionChange,
}: CodeEditorProps) {
  const [editor, setEditor] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationIds = useRef<string[]>([]);

  const handleMount: OnMount = (instance) => {
    setEditor(instance);

    if (onSelectionChange) {
      instance.onDidChangeCursorSelection((event) => {
        const startLine = event.selection.startLineNumber;
        const endLine = event.selection.endLineNumber;
        onSelectionChange({ startLine, endLine });
      });
    }
  };

  useEffect(() => {
    if (!editor) return;

    decorationIds.current = editor.deltaDecorations(
      decorationIds.current,
      highlights.map((highlight) => ({
        range: new Range(highlight.startLine, 1, highlight.endLine, 1),
        options: {
          isWholeLine: true,
          className: 'ai-highlight-line',
          glyphMarginClassName: 'ai-highlight-glyph',
          glyphMarginHoverMessage: { value: highlight.label ?? 'AI highlight' },
        },
      })),
    );
  }, [editor, highlights]);

  return (
    <Editor
      height="100%"
      defaultLanguage={guessLanguage(path)}
      defaultValue={content}
      path={path}
      theme="vs-dark"
      options={{
        readOnly,
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        glyphMargin: true,
      }}
      onMount={handleMount}
    />
  );
}

import { useEditorState, type Editor } from '@tiptap/react';
import type { ReactNode } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

function Btn(props: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const title = props.shortcut ? `${props.label} (${props.shortcut})` : props.label;
  return (
    <button
      type="button"
      className={`tb-btn${props.active ? ' is-active' : ''}`}
      title={title}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      // Keep focus (and the selection) in the editor when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render only when the bits of state the toolbar shows actually change.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const block = s.h1 ? 'h1' : s.h2 ? 'h2' : s.h3 ? 'h3' : 'p';
  const chain = () => editor.chain().focus();

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" shortcut={`${mod}Z`} disabled={!s.canUndo} onClick={() => chain().undo().run()}>↶</Btn>
      <Btn label="Redo" shortcut={`${mod}Shift+Z`} disabled={!s.canRedo} onClick={() => chain().redo().run()}>↷</Btn>
      <span className="tb-sep" />

      <select
        className="tb-select"
        aria-label="Text style"
        value={block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') chain().setParagraph().run();
          else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="tb-sep" />

      <Btn label="Bold" shortcut={`${mod}B`} active={s.bold} onClick={() => chain().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic" shortcut={`${mod}I`} active={s.italic} onClick={() => chain().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline" shortcut={`${mod}U`} active={s.underline} onClick={() => chain().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Strikethrough" shortcut={`${mod}Shift+S`} active={s.strike} onClick={() => chain().toggleStrike().run()}><s>S</s></Btn>
      <span className="tb-sep" />

      <Btn label="Bulleted list" shortcut={`${mod}Shift+8`} active={s.bullet} onClick={() => chain().toggleBulletList().run()}>•≡</Btn>
      <Btn label="Numbered list" shortcut={`${mod}Shift+7`} active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>1≡</Btn>
      <Btn label="Quote" shortcut={`${mod}Shift+B`} active={s.quote} onClick={() => chain().toggleBlockquote().run()}>❝</Btn>
      <span className="tb-sep" />
      <Btn label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>T̸</Btn>
    </div>
  );
}

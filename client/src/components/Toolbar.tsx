import { useEditorState, type Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';
const shift = isMac ? '⇧' : 'Shift+';
const ICON = { size: 18, strokeWidth: 2 } as const;

function Btn(props: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`tb-btn${props.active ? ' is-active' : ''}`}
      aria-label={props.shortcut ? `${props.label} (${props.shortcut})` : props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      data-tip={props.label}
      data-shortcut={props.shortcut}
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
      <Btn label="Undo" shortcut={`${mod}Z`} disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 {...ICON} />
      </Btn>
      <Btn label="Redo" shortcut={`${mod}${shift}Z`} disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 {...ICON} />
      </Btn>
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

      <Btn label="Bold" shortcut={`${mod}B`} active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold {...ICON} strokeWidth={2.5} />
      </Btn>
      <Btn label="Italic" shortcut={`${mod}I`} active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic {...ICON} />
      </Btn>
      <Btn label="Underline" shortcut={`${mod}U`} active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline {...ICON} />
      </Btn>
      <Btn label="Strikethrough" shortcut={`${mod}${shift}S`} active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough {...ICON} />
      </Btn>
      <span className="tb-sep" />

      <Btn label="Bulleted list" shortcut={`${mod}${shift}8`} active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List {...ICON} />
      </Btn>
      <Btn label="Numbered list" shortcut={`${mod}${shift}7`} active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered {...ICON} />
      </Btn>
      <Btn label="Quote" shortcut={`${mod}${shift}B`} active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote {...ICON} />
      </Btn>
      <span className="tb-sep" />
      <Btn label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting {...ICON} />
      </Btn>
    </div>
  );
}

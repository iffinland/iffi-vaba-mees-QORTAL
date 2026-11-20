import { useEffect, useRef, useState } from 'react';
import { FaBold, FaHighlighter, FaItalic, FaLink, FaListOl, FaListUl, FaPaperclip, FaSmile, FaTint } from 'react-icons/fa';
import { validateAttachmentFile } from '../../services/richTextAttachmentService';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import {
  ATTACHMENT_ACCEPT, ATTACHMENT_SELECTOR, cleanAttachmentElement, getAttachmentKind, MAX_ATTACHMENTS,
} from '../../utils/richTextAttachments';
import styles from './RichTextEditor.module.css';

const commands = [
  { command: 'bold', label: 'Bold', icon: <FaBold /> },
  { command: 'italic', label: 'Italic', icon: <FaItalic /> },
  { command: 'insertUnorderedList', label: 'Bullet list', icon: <FaListUl /> },
  { command: 'insertOrderedList', label: 'Numbered list', icon: <FaListOl /> },
];
const emoji = ['😀', '😂', '😊', '😍', '🤔', '😎', '😢', '😮', '👍', '👏', '🙏', '❤️', '🔥', '🎉', '✨', '🌿'];
const palette = [
  ['Black', '#222222'], ['Red', '#bd2026'], ['Orange', '#a45200'], ['Green', '#146b39'],
  ['Blue', '#145caa'], ['Purple', '#7536a1'], ['Pink', '#aa245b'], ['Gray', '#5d5d5d'],
];
const highlights = [
  ['Yellow', '#fff1a8'], ['Orange', '#ffdbb0'], ['Green', '#caedcf'],
  ['Blue', '#ceeaff'], ['Purple', '#eed9fa'], ['Pink', '#ffd8e8'], ['White', '#ffffff'],
];
const keepEditorSelection = (event) => event.preventDefault();

function RichTextEditor({ value, onChange, placeholder = 'Write here...', enhanced = false, disabled = false }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const isFocusedRef = useRef(false);
  const selectionRef = useRef(null);
  const filesRef = useRef(new Map());
  const [panel, setPanel] = useState('');
  const [attachmentError, setAttachmentError] = useState('');

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && !isFocusedRef.current && editor.innerHTML !== value) {
      editor.innerHTML = enhanced ? sanitizeHtml(value) : value || '';
      selectionRef.current = null;
    }
  }, [value, enhanced]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    let range = selectionRef.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const emit = () => {
    const html = editorRef.current.innerHTML;
    if (enhanced) {
      onChange(html, filesRef.current);
    } else {
      onChange(html);
    }
  };

  const runCommand = (command, argument = null) => {
    if (disabled) return;
    if (enhanced) restoreSelection();
    else editorRef.current?.focus();
    document.execCommand(command, false, argument);
    if (enhanced) rememberSelection();
    emit();
  };

  const addLink = () => {
    if (enhanced) rememberSelection();
    const url = window.prompt('Paste a link');
    if (url) runCommand('createLink', url);
  };

  const insertFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    setAttachmentError('');

    try {
      const editor = editorRef.current;
      const files = new Map(filesRef.current);
      const active = new Set(
        Array.from(editor.querySelectorAll(ATTACHMENT_SELECTOR), (element) => element.dataset.attachment)
          .filter((id) => files.has(id)),
      );
      if (active.size + selected.length > MAX_ATTACHMENTS) {
        throw new Error(`Select at most ${MAX_ATTACHMENTS} new attachments per publish.`);
      }
      const labels = selected.map((file) => {
        const kind = getAttachmentKind(file.name);
        validateAttachmentFile(file, kind);
        const bytes = crypto.getRandomValues(new Uint8Array(12));
        const id = 'ivm_att_' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const label = document.createElement('span');
        cleanAttachmentElement(label, { id, kind, filename: file.name });
        files.set(id, file);
        return label.outerHTML;
      });
      filesRef.current = files;
      runCommand('insertHTML', labels.join(' ') + '&nbsp;');
    } catch (error) {
      setAttachmentError(error.message);
    }
  };

  const togglePanel = (name) => {
    rememberSelection();
    setPanel((current) => current === name ? '' : name);
  };

  const applyFormatting = (command, argument) => {
    runCommand(command, argument);
    setPanel('');
  };

  return (
    <div className={styles.editorShell}>
      <div className={enhanced ? `${styles.toolbar} ${styles.enhancedToolbar}` : styles.toolbar} aria-label="Formatting tools">
        {commands.map((item) => (
          <button
            key={item.command}
            type="button"
            title={item.label}
            aria-label={item.label}
            disabled={disabled}
            onMouseDown={keepEditorSelection}
            onClick={() => runCommand(item.command)}
          >
            {item.icon}
          </button>
        ))}
        <button type="button" title="Add link" aria-label="Add link" disabled={disabled} onMouseDown={keepEditorSelection} onClick={addLink}>
          <FaLink />
        </button>
        {enhanced && (
          <>
            {[
              ['emoji', 'Add emoji', <FaSmile />],
              ['color', 'Text color', <FaTint />],
              ['highlight', 'Highlight color', <FaHighlighter />],
            ].map(([name, label, icon]) => (
              <button key={name} type="button" title={label} aria-label={label} aria-expanded={panel === name}
                disabled={disabled} onMouseDown={keepEditorSelection} onClick={() => togglePanel(name)}>
                {icon}
              </button>
            ))}
            <button type="button" title="Attach files" aria-label="Attach files" disabled={disabled}
              onMouseDown={keepEditorSelection} onClick={() => { rememberSelection(); fileInputRef.current.click(); }}>
              <FaPaperclip />
            </button>
            <input ref={fileInputRef} hidden type="file" multiple accept={ATTACHMENT_ACCEPT} onChange={insertFiles} disabled={disabled} />
          </>
        )}
      </div>
      {enhanced && panel && !disabled && (
        <div className={styles.palette} role="group" aria-label={panel === 'emoji' ? 'Emoji' : 'Colors'}>
          {panel === 'emoji'
            ? emoji.map((symbol) => (
              <button key={symbol} type="button" onMouseDown={keepEditorSelection}
                onClick={() => applyFormatting('insertText', symbol)}>{symbol}</button>
            ))
            : (panel === 'color' ? palette : highlights).map(([name, color]) => (
              <button key={color} type="button" title={name} aria-label={name}
                style={{ backgroundColor: color }} onMouseDown={keepEditorSelection}
                onClick={() => applyFormatting(panel === 'color' ? 'foreColor' : 'hiliteColor', color)} />
            ))}
        </div>
      )}
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => { isFocusedRef.current = false; if (enhanced) rememberSelection(); }}
        onInput={() => { if (enhanced) rememberSelection(); emit(); }}
        onMouseUp={enhanced ? rememberSelection : undefined}
        onKeyUp={enhanced ? rememberSelection : undefined}
        onPaste={enhanced ? (event) => {
          event.preventDefault();
          rememberSelection();
          const html = event.clipboardData.getData('text/html');
          if (html) runCommand('insertHTML', sanitizeHtml(html));
          else runCommand('insertText', event.clipboardData.getData('text/plain'));
        } : undefined}
        role="textbox"
        aria-label={placeholder}
        aria-multiline="true"
        tabIndex={0}
      />
      {enhanced && attachmentError && <p className={styles.attachmentError} role="alert">{attachmentError}</p>}
    </div>
  );
}

export default RichTextEditor;

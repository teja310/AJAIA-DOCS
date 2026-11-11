import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Doc } from './api';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

const DEBOUNCE_MS = 800;

/**
 * Debounced autosave with optimistic concurrency.
 *
 * - Changes are batched into one PATCH. Content is read lazily (getContent) at send time,
 *   so we don't serialize HTML on every keystroke.
 * - Only one request is in flight; edits made meanwhile are sent right after it finishes.
 * - Each PATCH carries the version we last saw. A 409 means someone else saved first: we
 *   stop autosaving and ask the user to reload rather than silently overwriting them.
 */
export function useAutosave(docId: string, initialVersion: number, getContent: () => string, onSaved: (d: Doc) => void) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const version = useRef(initialVersion);
  const pendingTitle = useRef<string | undefined>(undefined);
  const contentDirty = useRef(false);
  const inFlight = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ getContent, onSaved });
  latest.current = { getContent, onSaved };

  const hasPending = () => contentDirty.current || pendingTitle.current !== undefined;

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (inFlight.current || blocked.current || !hasPending()) return;

    const body: { title?: string; content_html?: string; version: number } = { version: version.current };
    if (pendingTitle.current !== undefined) body.title = pendingTitle.current;
    if (contentDirty.current) body.content_html = latest.current.getContent();
    pendingTitle.current = undefined;
    contentDirty.current = false;

    inFlight.current = true;
    setStatus('saving');
    try {
      const { document } = await api.updateDoc(docId, body);
      version.current = document.version;
      latest.current.onSaved(document);
      setError(null);
      inFlight.current = false;
      if (hasPending()) return flush();
      setStatus('saved');
    } catch (e) {
      inFlight.current = false;
      // Put the unsent changes back so a retry includes them.
      if (body.title !== undefined && pendingTitle.current === undefined) pendingTitle.current = body.title;
      if (body.content_html !== undefined) contentDirty.current = true;
      const err = e as ApiError;
      setError(err.message);
      if (err.status === 409) {
        blocked.current = true;
        setStatus('conflict');
      } else {
        setStatus('error');
      }
    }
  }, [docId]);

  const schedule = useCallback(() => {
    if (blocked.current) return;
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  const markContentChanged = useCallback(() => {
    contentDirty.current = true;
    schedule();
  }, [schedule]);

  const setTitle = useCallback(
    (title: string) => {
      pendingTitle.current = title;
      void flush();
    },
    [flush],
  );

  /** Used after a server-side change (e.g. import) to adopt the new version. */
  const adoptVersion = useCallback((v: number) => {
    version.current = v;
  }, []);

  // Warn before leaving with unsaved changes; try to save on unmount.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending() || inFlight.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      void flush();
    };
  }, [flush]);

  return { status, error, flush, markContentChanged, setTitle, adoptVersion };
}

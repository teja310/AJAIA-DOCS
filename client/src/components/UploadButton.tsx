import { useRef, type ReactNode } from 'react';
import { UPLOAD_ACCEPT, UPLOAD_HINT, checkUpload } from '../api';

interface Props {
  onFile: (file: File) => void;
  onInvalid: (message: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** A button that opens a file picker, validating type and size before handing the file over. */
export function UploadButton({ onFile, onInvalid, disabled, className = 'btn', children }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} title={UPLOAD_HINT} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow picking the same file again
          if (!file) return;
          const problem = checkUpload(file);
          if (problem) onInvalid(problem);
          else onFile(file);
        }}
      />
    </>
  );
}

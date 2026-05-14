import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ImportBookPdfModal } from '../components/books/ImportBookPdfModal';

export interface PdfBookImportSession {
  /** Forces a fresh modal mount each time the dialog opens. */
  dialogInstanceId: number;
  bookId: string;
  bookTitle: string;
  onImported?: () => void;
}

interface PdfBookImportContextValue {
  openPdfBookImport: (session: Omit<PdfBookImportSession, 'dialogInstanceId'>) => void;
}

const PdfBookImportContext = createContext<PdfBookImportContextValue | null>(null);

export function PdfBookImportProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PdfBookImportSession | null>(null);
  const isImportRunningRef = useRef(false);

  const markImportRunning = useCallback((isRunning: boolean) => {
    isImportRunningRef.current = isRunning;
  }, []);

  const openPdfBookImport = useCallback((next: Omit<PdfBookImportSession, 'dialogInstanceId'>) => {
    if (isImportRunningRef.current) {
      window.alert('An import is already in progress. Cancel it in the import dialog first.');
      return;
    }
    const dialogInstanceId = Date.now();
    setSession({ ...next, dialogInstanceId });
  }, []);

  const value = useMemo(() => ({ openPdfBookImport }), [openPdfBookImport]);

  return (
    <PdfBookImportContext.Provider value={value}>
      {children}
      {session ? (
        <ImportBookPdfModal
          key={session.dialogInstanceId}
          isOpen
          bookId={session.bookId}
          bookTitle={session.bookTitle}
          onClose={() => setSession(null)}
          onImported={() => {
            session.onImported?.();
            setSession(null);
          }}
          onImportRunningChange={markImportRunning}
        />
      ) : null}
    </PdfBookImportContext.Provider>
  );
}

export function usePdfBookImport(): PdfBookImportContextValue {
  const ctx = useContext(PdfBookImportContext);
  if (!ctx) {
    throw new Error('usePdfBookImport must be used within PdfBookImportProvider.');
  }
  return ctx;
}

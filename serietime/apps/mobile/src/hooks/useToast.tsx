import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Toast } from '@serietime/ui';

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toast message={message} visible={visible} />
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

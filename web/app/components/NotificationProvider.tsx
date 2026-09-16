'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';

type Tone = 'success' | 'error' | 'info';
type Notice = {id: number; message: string; tone: Tone};
type Notify = (message: string, tone?: Tone) => void;
const NotificationContext = createContext<Notify | null>(null);
type DialogRequest = {kind: 'confirm' | 'prompt'; title: string; message: string; placeholder?: string; resolve: (value: boolean | string | null) => void};
type DialogApi = {confirm: (message: string, title?: string) => Promise<boolean>; prompt: (message: string, title?: string, placeholder?: string) => Promise<string | null>};
const DialogContext = createContext<DialogApi | null>(null);

export default function NotificationProvider({children}: {children: React.ReactNode}) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const confirm = useCallback((message: string, title = '请确认') => new Promise<boolean>((resolve) => setDialog({kind: 'confirm', title, message, resolve: (value) => resolve(value === true)})), []);
  const prompt = useCallback((message: string, title = '请输入', placeholder = '') => new Promise<string | null>((resolve) => setDialog({kind: 'prompt', title, message, placeholder, resolve: (value) => resolve(typeof value === 'string' ? value : null)})), []);
  const closeDialog = useCallback((value: boolean | string | null) => { const current = dialog; setDialog(null); current?.resolve(value); }, [dialog]);
  const remove = useCallback((id: number) => setNotices((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback<Notify>((message, tone = 'info') => {
    const id = nextId.current++;
    setNotices((items) => {
      if (items.some((item) => item.message === message && item.tone === tone)) return items;
      return [...items.slice(-2), {id, message, tone}];
    });
    const timer = window.setTimeout(() => { timers.current.delete(timer); remove(id); }, 5000);
    timers.current.add(timer);
  }, [remove]);
  useEffect(() => () => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current.clear(); }, []);
  const value = useMemo(() => notify, [notify]);
  const dialogValue = useMemo(() => ({confirm, prompt}), [confirm, prompt]);
  return <DialogContext.Provider value={dialogValue}><NotificationContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{notices.map((notice) => <div className={`toast ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'} key={notice.id}><span>{notice.message}</span><button aria-label="关闭通知" onClick={() => remove(notice.id)}>×</button></div>)}</div>{dialog && <DialogSurface dialog={dialog} onResolve={closeDialog} />}</NotificationContext.Provider></DialogContext.Provider>;
}

function DialogSurface({dialog, onResolve}: {dialog: DialogRequest; onResolve: (value: boolean | string | null) => void}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onResolve(null); }}><section className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="notification-dialog-title"><header><h2 id="notification-dialog-title">{dialog.title}</h2><button type="button" className="icon-button" aria-label="关闭" onClick={() => onResolve(null)}>×</button></header><div className="ui-modal-body"><p>{dialog.message}</p>{dialog.kind === 'prompt' && <input ref={inputRef} aria-label={dialog.title} className="ui-dialog-input" value={input} placeholder={dialog.placeholder} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onResolve(input); if (event.key === 'Escape') onResolve(null); }} />}</div><footer><button type="button" className="btn btn-secondary" onClick={() => onResolve(null)}>取消</button><button type="button" className="btn btn-primary" onClick={() => onResolve(dialog.kind === 'prompt' ? input : true)}>{dialog.kind === 'prompt' ? '确定' : '继续'}</button></footer></section></div>;
}

export function useNotifier(): Notify {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('NOTIFICATION_PROVIDER_MISSING');
  return value;
}

export function useConfirm(): DialogApi['confirm'] {
  const value = useContext(DialogContext);
  return value?.confirm ?? ((message) => Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false));
}

export function usePrompt(): DialogApi['prompt'] {
  const value = useContext(DialogContext);
  return value?.prompt ?? ((message) => Promise.resolve(typeof window !== 'undefined' ? window.prompt(message) : null));
}

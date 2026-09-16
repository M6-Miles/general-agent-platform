import type {ReactNode} from 'react';

type ModalProps = {open: boolean; title: string; children: ReactNode; onClose: () => void};

export default function Modal({open, title, children, onClose}: ModalProps) {
  if (!open) return null;
  return <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title"><header><h2 id="ui-modal-title">{title}</h2><button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>×</button></header><div className="ui-modal-body">{children}</div></section></div>;
}

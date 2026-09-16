'use client';
import {forwardRef, type TextareaHTMLAttributes, useId} from 'react';
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {label?: string; error?: string; helpText?: string};
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({label, error, helpText, id, ...props}, ref) {
  const generatedId = useId(); const textareaId = id ?? generatedId;
  return <div className="input-wrapper">{label && <label className="input-label" htmlFor={textareaId}>{label}</label>}<textarea ref={ref} id={textareaId} className={`ui-textarea${error ? ' input-error' : ''}`} aria-invalid={Boolean(error)} {...props} />{error ? <span className="input-error-text" role="alert">{error}</span> : helpText && <span className="input-help-text">{helpText}</span>}</div>;
});
export default Textarea;

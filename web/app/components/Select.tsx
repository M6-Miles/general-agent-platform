'use client';
import {forwardRef, type SelectHTMLAttributes, useId} from 'react';
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {label?: string; error?: string; helpText?: string};
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({label, error, helpText, id, children, ...props}, ref) {
  const generatedId = useId(); const selectId = id ?? generatedId;
  return <div className="input-wrapper">{label && <label className="input-label" htmlFor={selectId}>{label}</label>}<select ref={ref} id={selectId} className={`ui-select${error ? ' input-error' : ''}`} aria-invalid={Boolean(error)} {...props}>{children}</select>{error ? <span className="input-error-text" role="alert">{error}</span> : helpText && <span className="input-help-text">{helpText}</span>}</div>;
});
export default Select;

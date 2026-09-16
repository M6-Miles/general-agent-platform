import {forwardRef, useId} from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {label?: string; error?: string; helpText?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode};
const Input = forwardRef<HTMLInputElement, InputProps>(({label, error, helpText, leftIcon, rightIcon, id, className = '', ...props}, ref) => { const generatedId = useId(); const inputId = id ?? generatedId; const input = <input ref={ref} id={inputId} className={`ui-input ${className}`} aria-invalid={Boolean(error)} {...props} />; return <div className="input-wrapper">{label && <label className="input-label" htmlFor={inputId}>{label}</label>}{leftIcon || rightIcon ? <div className={`input-container ${error ? 'input-error' : ''}`}>{leftIcon}{input}{rightIcon}</div> : input}{error ? <span className="input-error-text" role="alert">{error}</span> : helpText && <span className="input-help-text">{helpText}</span>}</div>; });
Input.displayName = 'Input';
export default Input;

import {forwardRef} from 'react';
import {Loader2} from 'lucide-react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: React.ReactNode};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({variant = 'primary', size = 'md', loading = false, icon, children, className = '', disabled, ...props}, ref) => <button ref={ref} className={`btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`} disabled={disabled || loading} {...props}>{loading ? <Loader2 className="btn-spinner" size={16} aria-hidden="true" /> : icon}<span>{children}</span></button>);
Button.displayName = 'Button';
export default Button;

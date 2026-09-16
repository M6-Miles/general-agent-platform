import {forwardRef} from 'react';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'; size?: 'sm' | 'md' | 'lg'; dot?: boolean};
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({variant = 'default', size = 'md', dot = false, className = '', children, ...props}, ref) => <span ref={ref} className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`} {...props}>{dot && <i className="ui-badge-dot" aria-hidden="true" />}{children}</span>);
Badge.displayName = 'Badge';
export default Badge;

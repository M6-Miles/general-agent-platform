import {forwardRef} from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {variant?: 'default' | 'bordered' | 'elevated'; padding?: 'none' | 'sm' | 'md' | 'lg'};
const Card = forwardRef<HTMLDivElement, CardProps>(({variant = 'default', padding = 'md', className = '', children, ...props}, ref) => <div ref={ref} className={`card card-${variant} card-padding-${padding} ${className}`} {...props}>{children}</div>);
Card.displayName = 'Card';
export default Card;

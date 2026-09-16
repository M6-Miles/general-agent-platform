import type {HTMLAttributes} from 'react';

export default function Loading({label = '加载中', className = '', ...props}: HTMLAttributes<HTMLDivElement> & {label?: string}) {
  return <div className={`ui-loading ${className}`.trim()} role="status" aria-live="polite" {...props}><span className="ui-loading-spinner" aria-hidden="true" />{label}</div>;
}

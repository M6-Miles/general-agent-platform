import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
  it('renders variant, size and text', () => {
    render(<Badge variant="success" size="sm">Completed</Badge>);
    expect(screen.getByText('Completed')).toHaveClass('ui-badge-success', 'ui-badge-sm');
  });
  it('renders a decorative status dot', () => {
    const {container} = render(<Badge dot>Pending</Badge>);
    expect(container.querySelector('.ui-badge-dot')).toHaveAttribute('aria-hidden', 'true');
  });
});

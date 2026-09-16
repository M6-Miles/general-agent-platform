import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import Card from './Card';

describe('Card', () => {
  it('renders content and style props', () => {
    render(<Card variant="elevated" padding="lg">Summary</Card>);
    expect(screen.getByText('Summary')).toHaveClass('card-elevated', 'card-padding-lg');
  });
  it('forwards attributes and custom classes', () => {
    render(<Card aria-label="Run card" className="custom">Details</Card>);
    expect(screen.getByLabelText('Run card')).toHaveClass('custom', 'card-default');
  });
});

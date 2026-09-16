import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders variant and children', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', {name: 'Delete'})).toHaveClass('btn-danger', 'btn-md');
  });
  it('forwards click events', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('disables while loading', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

import { render, screen } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it('renders with default props', () => {
    render(<Header />);

    expect(screen.getByText('AI Study Planner')).toBeInTheDocument();
    expect(screen.getByText(/New Plan/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search study plans...')).toBeInTheDocument();
  });

  it('renders with custom title and action label', () => {
    render(<Header title="Custom Title" actionLabel="Custom Action" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText(/Custom Action/)).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<Header subtitle="Custom Subtitle" />);

    expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<Header />);

    expect(screen.queryByText('Custom Subtitle')).not.toBeInTheDocument();
  });
});
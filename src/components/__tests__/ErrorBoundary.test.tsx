import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function Bomb(): React.ReactNode {
  throw new Error('Test error');
  return null;
}

function GoodChild() {
  return <div>Child rendered</div>;
}

describe('ErrorBoundary', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child rendered')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Kuch gadbad ho gayi!')).toBeInTheDocument();
    expect(screen.getByText('Dobara Try Karo')).toBeInTheDocument();
  });

  it('shows error message in fallback', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('shows custom fallback title and message', () => {
    render(
      <ErrorBoundary fallbackTitle="Custom Title" fallbackMessage="Custom msg">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom msg')).toBeInTheDocument();
  });

  it('recovers when retry button clicked', () => {
    let shouldThrow = true;
    function ConditionalBomb() {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered!</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Kuch gadbad ho gayi!')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Dobara Try Karo'));

    rerender(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered!')).toBeInTheDocument();
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// Error Boundary - App crash se bachata hai
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {this.props.fallbackTitle || 'Kuch gadbad ho gayi!'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {this.props.fallbackMessage || 'Ye section crash ho gaya. Dobara try karo.'}
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 mb-4 bg-red-50 rounded-xl p-3 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button
              onClick={this.handleRetry}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl h-12 px-8"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Dobara Try Karo
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    try {
      const userId = localStorage.getItem('userId');
      const errorReport = {
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      console.error('[Error Report]', JSON.stringify(errorReport, null, 2));
    } catch (reportError) {
      console.error('Failed to generate error report:', reportError);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="min-h-screen bg-default-background flex items-center justify-center p-6"
          data-testid="error-boundary-fallback"
        >
          <div className="max-w-lg w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-error-100 dark:bg-error-900 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-error-600 dark:text-error-400" />
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-heading-2 font-heading-2 text-default-font mb-2">
                  Noget gik galt
                </h1>
                <p className="text-body font-body text-subtext-color">
                  Vi beklager, men der opstod en uventet fejl. Dit data er sikkert.
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700">
                <p className="text-caption-bold font-caption-bold text-error-600 dark:text-error-400 mb-2">
                  Fejlbesked:
                </p>
                <pre className="text-caption font-caption text-default-font whitespace-pre-wrap break-words overflow-x-auto">
                  {this.state.error.toString()}
                </pre>
                {this.state.error.stack && (
                  <details className="mt-3">
                    <summary className="text-caption-bold font-caption-bold text-subtext-color cursor-pointer hover:text-default-font">
                      Se tekniske detaljer
                    </summary>
                    <pre className="mt-2 text-caption font-caption text-subtext-color whitespace-pre-wrap break-words overflow-x-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1"
                variant="default"
                data-testid="button-try-again"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Prøv igen
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex-1"
                variant="outline"
                data-testid="button-reload"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Genindlæs siden
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                data-testid="button-home"
              >
                <Home className="w-4 h-4 mr-2" />
                Hjem
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-caption font-caption text-subtext-color text-center">
                Hvis problemet fortsætter, kontakt venligst support
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

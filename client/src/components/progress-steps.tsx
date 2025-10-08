interface ProgressStepsProps {
  currentStep: number;
  steps: string[];
}

export default function ProgressSteps({ currentStep, steps }: ProgressStepsProps) {
  return (
    <div className="mb-12">
      <div className="flex items-start justify-between mb-8">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isLast = index === steps.length - 1;
          
          return (
            <div 
              key={stepNumber}
              className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              data-testid={`progress-step-${stepNumber}`}
            >
              <div className="step-indicator">
                {isCompleted ? (
                  <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              <p className={`mt-3 text-center text-sm font-semibold ${
                isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

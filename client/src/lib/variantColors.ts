export const getVariantBackgroundClass = (variant: string): string => {
  const variantColors: {[key: string]: string} = {
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
  };
  return variantColors[variant] || variantColors.info;
};

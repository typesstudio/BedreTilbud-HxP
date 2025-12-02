/**
 * Step 3.2: Null-safe savings formatting utilities for frontend
 * 
 * Provides robust formatting functions that never produce NaN or undefined values.
 * Returns explicit fallback messages when data is missing.
 */

/**
 * Safely formats a currency value for display.
 * Returns fallback string when value is null/undefined/NaN.
 * 
 * @param amount - Numeric value to format
 * @param fallback - String to return when value is invalid (default: "Pris ukendt")
 * @returns Formatted currency string or fallback
 */
export function formatCurrencySafe(
  amount: number | null | undefined,
  fallback: string = "Pris ukendt"
): string {
  if (amount == null || !Number.isFinite(amount)) {
    return fallback;
  }
  
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + " kr";
}

/**
 * Safely formats a percentage value for display.
 * Returns fallback string when value is null/undefined/NaN.
 * 
 * @param value - Percentage value (e.g., 15.5 for 15.5%)
 * @param fallback - String to return when value is invalid (default: "")
 * @returns Formatted percentage string or fallback
 */
export function formatPercentageSafe(
  value: number | null | undefined,
  fallback: string = ""
): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  
  const sign = value > 0 ? "-" : value < 0 ? "+" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/**
 * Checks if savings data is valid and can be displayed.
 * Use this to conditionally render savings components.
 * 
 * @param hasPrice - The hasPrice flag from API response
 * @param savingsAmount - The savings amount to check
 * @returns true if savings data is valid
 */
export function hasSavingsData(
  hasPrice: boolean | undefined,
  savingsAmount: number | null | undefined
): boolean {
  if (hasPrice === false) return false;
  if (savingsAmount == null || !Number.isFinite(savingsAmount)) return false;
  return true;
}

/**
 * Checks if chart data is valid and can be displayed.
 * 
 * @param chartData - Array of chart data points
 * @returns true if chart has valid data
 */
export function hasChartData(
  chartData: Array<{ month?: string; label?: string; savings?: number; Besparelse?: number }> | undefined
): boolean {
  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) return false;
  
  const firstValue = chartData[0]?.savings ?? chartData[0]?.Besparelse;
  const lastValue = chartData[chartData.length - 1]?.savings ?? chartData[chartData.length - 1]?.Besparelse;
  
  if (firstValue == null && lastValue == null) return false;
  
  return true;
}

/**
 * Component for displaying "price unknown" message.
 * Use this when hasPrice is false or savings data is missing.
 */
export const PRICE_UNKNOWN_MESSAGE = "Pris kunne ikke aflæses automatisk";
export const PRICE_UNKNOWN_HINT = "Du kan stadig sammenligne dækning, men vi kan ikke beregne den præcise besparelse.";

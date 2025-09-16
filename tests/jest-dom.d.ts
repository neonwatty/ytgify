import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveClass(...classNames: string[]): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value: string | string[] | number): R;
      toBeChecked(): R;
      toHaveStyle(style: string | Record<string, any>): R;
      toBeEmpty(): R;
      toContainElement(element: HTMLElement | null): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toContainHTML(html: string): R;
      toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveErrorMessage(text?: string | RegExp): R;
      toHaveFocus(): R;
      toHaveFormValues(values: Record<string, any>): R;
    }
  }
}

export {};
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia for Ant Design layout compatibility in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Ant Design components in jsdom
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Mock Recharts to avoid jsdom layout engine SVG rendering failures
vi.mock('recharts', async () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    ReferenceLine: () => <div data-testid="reference-line" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => <div data-testid="pie" />,
    Cell: () => <div data-testid="cell" />,
  };
});

// Mock Ant Design Select component to render as a native HTML select element
// This allows simple selection simulation in testing environments
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal();
  
  const MockSelect = ({ children, value, onChange, id, ariaLabel, ...props }) => {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        aria-label={ariaLabel}
        data-testid={props['data-testid']}
      >
        {children}
      </select>
    );
  };
  
  MockSelect.Option = ({ children, value, ...props }) => {
    return (
      <option value={value} {...props}>
        {children}
      </option>
    );
  };

  return {
    ...actual,
    Select: MockSelect,
  };
});

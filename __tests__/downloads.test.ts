import { formatBytes } from '../lib/utils/downloads';

describe('formatBytes', () => {
  it('returns "0 o" for zero', () => {
    expect(formatBytes(0)).toBe('0 o');
  });

  it('returns "0 o" for negative', () => {
    expect(formatBytes(-100)).toBe('0 o');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(512 * 1024)).toBe('512 Ko');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 Mo');
  });

  it('formats gigabytes with two decimals', () => {
    expect(formatBytes(2.25 * 1024 * 1024 * 1024)).toBe('2.25 Go');
  });
});

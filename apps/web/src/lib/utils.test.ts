import { describe, it, expect } from 'vitest';
import { formatDuration } from './utils';

describe('formatDuration', () => {
  it('returns "0s" for zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns "0s" for negative values', () => {
    expect(formatDuration(-5)).toBe('0s');
    expect(formatDuration(-100)).toBe('0s');
  });

  it('returns "0s" for NaN and Infinity', () => {
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(Infinity)).toBe('0s');
    expect(formatDuration(-Infinity)).toBe('0s');
  });

  it('formats seconds under 60 as Xs', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(5)).toBe('5s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats 60 seconds as 1m 0s', () => {
    expect(formatDuration(60)).toBe('1m 0s');
  });

  it('formats minutes with remaining seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(127)).toBe('2m 7s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(7325)).toBe('2h 2m');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(59.4)).toBe('59s');
    expect(formatDuration(59.6)).toBe('1m 0s');
    expect(formatDuration(0.4)).toBe('0s');
  });
});

/**
 * Repository utility functions
 */

/**
 * Extract a display name from a file path (last segment).
 *
 * @param filePath - Absolute path to a directory
 * @returns The last path segment, or the original path if extraction fails
 *
 * @example
 * extractDisplayName('/Users/dev/my-project') // 'my-project'
 * extractDisplayName('C:\\Users\\dev\\my-project') // 'my-project'
 */
export function extractDisplayName(filePath: string): string {
  // Handle both Unix and Windows paths
  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments[segments.length - 1] || filePath;
}

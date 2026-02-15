import {
  RepositoryEvents,
  createLogger,
  type RecentProject,
  type RepoInfo,
  type ValidateRepositoryPayload,
  type ValidateRepositoryResponse,
  type GithubRemoteResponse,
} from '@gitchorus/shared';
import { emitAsync } from './socketHelpers';
import { useRepositoryStore } from '@/stores/useRepositoryStore';

const logger = createLogger('RecentProjects');
const MAX_RECENT_PROJECTS = 5;
const STORE_KEY = 'recentProjects';

/** Load recent projects from electron-store */
export async function loadRecentProjects(): Promise<RecentProject[]> {
  try {
    const stored = await window.electronAPI?.store.get<RecentProject[]>(STORE_KEY);
    return stored ?? [];
  } catch (err) {
    logger.warn('Failed to load recent projects:', err);
    return [];
  }
}

/** Save a project to recent projects (deduplicates by path, prepends, caps at MAX) */
export async function saveRecentProject(
  localPath: string,
  name: string,
  currentBranch: string,
  github: RepoInfo | null
): Promise<void> {
  try {
    const existing = await loadRecentProjects();
    const filtered = existing.filter(p => p.localPath !== localPath);

    const updated: RecentProject[] = [
      { localPath, name, currentBranch, github, lastOpened: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT_PROJECTS);

    await window.electronAPI?.store.set(STORE_KEY, updated);
    logger.info('Saved recent project:', name);
  } catch (err) {
    logger.warn('Failed to save recent project:', err);
  }
}

/** Remove a project from recent projects (e.g. when path no longer valid) */
export async function removeRecentProject(localPath: string): Promise<void> {
  try {
    const existing = await loadRecentProjects();
    const updated = existing.filter(p => p.localPath !== localPath);
    await window.electronAPI?.store.set(STORE_KEY, updated);
    logger.info('Removed recent project:', localPath);
  } catch (err) {
    logger.warn('Failed to remove recent project:', err);
  }
}

/** Get the most recently opened project (for auto-restore) */
export async function getMostRecentProject(): Promise<RecentProject | null> {
  const projects = await loadRecentProjects();
  return projects[0] ?? null;
}

/**
 * Connect to a project by path — validates, detects GitHub remote, and updates the store.
 *
 * This is a standalone function (not a hook) so it can be called from both
 * useAppInitialization and WelcomeView click handlers.
 */
export async function connectToProject(project: RecentProject): Promise<void> {
  const { setRepository, setError, setRestoring } = useRepositoryStore.getState();

  try {
    setRestoring(true);
    setError(null);

    logger.info('Connecting to recent project:', project.name);

    // Validate the path still exists and is a git repo
    const validation = await emitAsync<ValidateRepositoryPayload, ValidateRepositoryResponse>(
      RepositoryEvents.VALIDATE_REPO,
      { projectPath: project.localPath }
    );

    if (!validation.valid) {
      logger.warn('Recent project no longer valid:', project.localPath, validation.reason);
      await removeRecentProject(project.localPath);
      setError(validation.reason ?? 'Repository is no longer valid');
      return;
    }

    // Detect GitHub remote (best effort)
    let githubInfo: RepoInfo | null = null;
    try {
      const remoteResponse = await emitAsync<ValidateRepositoryPayload, GithubRemoteResponse>(
        RepositoryEvents.GET_GITHUB_REMOTE,
        { projectPath: project.localPath }
      );
      if (remoteResponse.repo && !remoteResponse.error) {
        githubInfo = remoteResponse.repo;
      }
    } catch (err) {
      logger.warn('Failed to detect GitHub remote (non-blocking):', err);
    }

    const repoName = validation.repoName ?? project.name;
    const branch = validation.currentBranch ?? project.currentBranch;

    setRepository(
      repoName === project.name ? project.localPath : project.localPath,
      repoName,
      branch,
      githubInfo
    );

    // Update recent projects with fresh data
    await saveRecentProject(project.localPath, repoName, branch, githubInfo);

    logger.info('Recent project connected:', repoName);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect to recent project';
    logger.error('Recent project connection failed:', message);
    await removeRecentProject(project.localPath);
    setError(message);
  } finally {
    setRestoring(false);
  }
}

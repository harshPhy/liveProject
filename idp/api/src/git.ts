import simpleGit, { ResetMode, SimpleGit, SimpleGitOptions } from 'simple-git';
import { terraformDir } from './terraform';

const gitOptions: Partial<SimpleGitOptions> = {
  baseDir: terraformDir,
  binary: 'git',
  maxConcurrentProcesses: 1,
};

const git: SimpleGit = simpleGit(gitOptions);

export async function resetToRemote() {

  // Ensure we have the latest commits from the remote
  await git.fetch(['--all'])

  // Revert changes to files that have been added to the index
  await git.reset(ResetMode.HARD, ['origin/main'])

}

export default git;
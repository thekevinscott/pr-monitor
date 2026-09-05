import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Prediction } from 'willfire';
import type { PredictPr } from '../types';
import { predictArgs } from './predictArgs';

const execFileAsync = promisify(execFile);

/**
 * Predicts by spawning willfire's CLI. The token is placed in `GH_TOKEN`, which
 * willfire reads ahead of `GITHUB_TOKEN`, so the action's configured token wins
 * over whatever the surrounding job happens to export.
 */
export function makePredictor(cli: string, token: string): PredictPr {
  return async (slug, pullNumber, inputs) => {
    const args = [cli, ...predictArgs(slug, pullNumber, inputs)];
    let stdout: string;
    try {
      // No `cwd`: a resolver callback inherits this child's, which has to stay
      // the workspace the monitor was started in (#78).
      ({ stdout } = await execFileAsync(process.execPath, args, {
        env: { ...process.env, GH_TOKEN: token },
        // A prediction over a repo with many matrix legs runs well past execFile's 1MB default.
        maxBuffer: 32 * 1024 * 1024,
      }));
    } catch (err) {
      const said = (err as { stderr?: string }).stderr?.trim();
      throw new Error(`willfire prediction failed: ${said || String(err)}`);
    }
    try {
      return JSON.parse(stdout) as Prediction;
    } catch {
      throw new Error(`willfire printed no prediction: ${stdout.trim()}`);
    }
  };
}

/**
 * Config File Loader
 *
 * Loads configuration from .skills-sec.yaml file.
 * Config file is optional - returns empty object if not found.
 */
import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { join } from 'path';
/**
 * Load config from .skills-sec.yaml file
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Parsed config object or empty object if file doesn't exist
 */
export async function loadConfig(cwd) {
    const configPath = join(cwd || process.cwd(), '.skills-sec.yaml');
    try {
        const content = await readFile(configPath, 'utf-8');
        const config = yaml.load(content);
        return config || {};
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            // Config file is optional
            return {};
        }
        throw new Error(`Invalid config file: ${error.message}`);
    }
}

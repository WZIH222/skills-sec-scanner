/**
 * Config File Loader
 *
 * Loads configuration from .skills-sec.yaml file.
 * Config file is optional - returns empty object if not found.
 */
export interface CliConfig {
    aiEnabled?: boolean;
    aiProvider?: 'openai' | 'anthropic';
    policyMode?: 'strict' | 'moderate' | 'permissive';
}
/**
 * Load config from .skills-sec.yaml file
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Parsed config object or empty object if file doesn't exist
 */
export declare function loadConfig(cwd?: string): Promise<CliConfig>;
//# sourceMappingURL=loader.d.ts.map
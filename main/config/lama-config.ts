import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface LamaConfig {
    instance: {
        name: string;
        email: string;
        secret: string;
        directory: string;
        wipeStorage?: boolean;
    };
    commServer: {
        url: string;
    };
    web: {
        url?: string;  // URL for browser access (Vite dev server or production)
    };
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
    };
}

const defaultConfig: LamaConfig = {
    instance: {
        name: 'LAMA Instance',
        email: 'user@lama.local',
        secret: '', // Must be provided
        directory: path.join(os.homedir(), 'Documents', 'LAMA', 'OneDB'),
        wipeStorage: false
    },
    commServer: {
        url: 'wss://comm.refinio.one'  // Production commserver (was: wss://comm10.dev.refinio.one)
    },
    web: {
        url: undefined  // No default web URL - must be configured
    },
    logging: {
        level: 'info'
    }
};

/**
 * Parse CLI arguments into config object
 */
function parseCLIArgs(): Partial<LamaConfig> {
    const args = process.argv.slice(2);
    const config: any = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--commserver=') || arg.startsWith('--comm-server=')) {
            config.commServer = { url: arg.split('=')[1] };
        } else if (arg.startsWith('--storage=') || arg.startsWith('--instance-directory=')) {
            if (!config.instance) config.instance = {};
            config.instance.directory = arg.split('=')[1];
        } else if (arg.startsWith('--instance-name=')) {
            if (!config.instance) config.instance = {};
            config.instance.name = arg.split('=')[1];
        } else if (arg.startsWith('--instance-email=')) {
            if (!config.instance) config.instance = {};
            config.instance.email = arg.split('=')[1];
        } else if (arg.startsWith('--web-url=')) {
            if (!config.web) config.web = {};
            config.web.url = arg.split('=')[1];
        } else if (arg.startsWith('--wipe-storage')) {
            if (!config.instance) config.instance = {};
            config.instance.wipeStorage = true;
        } else if (arg.startsWith('--log-level=')) {
            if (!config.logging) config.logging = {};
            config.logging.level = arg.split('=')[1];
        }
    }

    return config;
}

/**
 * Deep merge config objects
 */
function mergeConfig(base: any, override: any): any {
    const result = { ...base };
    for (const key in override) {
        if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
            result[key] = mergeConfig(base[key] || {}, override[key]);
        } else {
            result[key] = override[key];
        }
    }
    return result;
}

/**
 * Load configuration from files, environment variables, and CLI arguments.
 * Precedence: CLI args > Environment variables > Config files > Defaults
 */
export async function loadConfig(): Promise<LamaConfig> {
    // Start with defaults
    let config: LamaConfig = JSON.parse(JSON.stringify(defaultConfig));

    // Try loading from config files (in order of precedence)
    const configPaths = [
        path.join(process.cwd(), 'lama.config.json'),
        path.join(os.homedir(), '.lama', 'config.json'),
    ];

    for (const configPath of configPaths) {
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const fileConfig = JSON.parse(content);
            config = { ...config, ...fileConfig };
            console.log(`[LamaConfig] Loaded config from: ${configPath}`);
            break; // Use first found config file
        } catch (error) {
            // Config file not found, try next
        }
    }

    // Environment variables OVERRIDE config file settings
    if (process.env.LAMA_INSTANCE_NAME) {
        config.instance.name = process.env.LAMA_INSTANCE_NAME;
    }

    if (process.env.LAMA_INSTANCE_EMAIL) {
        config.instance.email = process.env.LAMA_INSTANCE_EMAIL;
    }

    if (process.env.LAMA_INSTANCE_SECRET) {
        config.instance.secret = process.env.LAMA_INSTANCE_SECRET;
    }

    if (process.env.LAMA_INSTANCE_DIRECTORY) {
        config.instance.directory = process.env.LAMA_INSTANCE_DIRECTORY;
    }

    if (process.env.LAMA_WIPE_STORAGE !== undefined) {
        config.instance.wipeStorage = process.env.LAMA_WIPE_STORAGE === 'true';
    }

    if (process.env.LAMA_COMM_SERVER_URL) {
        config.commServer.url = process.env.LAMA_COMM_SERVER_URL;
    }

    if (process.env.LAMA_WEB_URL) {
        config.web.url = process.env.LAMA_WEB_URL;
    }

    if (process.env.LAMA_LOG_LEVEL) {
        config.logging.level = process.env.LAMA_LOG_LEVEL as LamaConfig['logging']['level'];
    }

    // CLI arguments OVERRIDE everything (highest precedence)
    const cliConfig = parseCLIArgs();
    if (Object.keys(cliConfig).length > 0) {
        console.log('[LamaConfig] Applying CLI arguments:', cliConfig);
        config = mergeConfig(config, cliConfig);
    }

    console.log('[LamaConfig] Final configuration:', {
        instanceName: config.instance.name,
        instanceEmail: config.instance.email,
        instanceDirectory: config.instance.directory,
        commServerUrl: config.commServer.url,
        webUrl: config.web.url,
        wipeStorage: config.instance.wipeStorage,
        logLevel: config.logging.level
    });

    return config;
}

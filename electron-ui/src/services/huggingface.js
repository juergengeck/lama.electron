/**
 * HuggingFace Model Download Service
 * Uses Electron main process for real downloads without CORS issues
 */
/**
 * Known HuggingFace models with their download information
 */
export const HUGGINGFACE_MODELS = {
    'openai-gpt-oss-20b': {
        id: 'openai-gpt-oss-20b',
        name: 'OpenAI GPT-OSS (20B)',
        repoId: 'openai/gpt-oss-20b',
        files: [
            'model-00001-of-00002.safetensors', // 4.8GB
            'model-00002-of-00002.safetensors', // 4.17GB  
            'model.safetensors.index.json' // Index file
        ],
        expectedSize: 9 * 1024 * 1024 * 1024, // ~9GB total
        description: 'OpenAI\'s 21B model with MXFP4 quantization'
    },
    'qwen2.5-coder-32b': {
        id: 'qwen2.5-coder-32b',
        name: 'Qwen2.5 Coder (32B)',
        repoId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        files: [
            'model-00001-of-00009.safetensors', // Download first chunk for testing
        ],
        expectedSize: 5 * 1024 * 1024 * 1024, // ~5GB (single chunk for now)
        description: 'Top-tier code generation model'
    },
    'llama-3.1-8b': {
        id: 'llama-3.1-8b',
        name: 'Llama 3.1 (8B)',
        repoId: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        files: [
            'model-00001-of-00004.safetensors', // Download first chunk for testing
        ],
        expectedSize: 2 * 1024 * 1024 * 1024, // ~2GB (single chunk for now)
        description: 'Meta\'s efficient language model'
    }
};
/**
 * Get the local storage path for a model
 */
function getModelPath(modelId) {
    // Use a models directory relative to user data
    const userDataPath = process.platform === 'darwin' ?
        `${process.env.HOME}/Library/Application Support` :
        (process.env.APPDATA || process.env.HOME || '/tmp');
    return path.join(userDataPath, 'LAMA', 'models', modelId, 'model.bin');
}
/**
 * Check if a model exists locally
 */
export async function checkModelExists(modelId) {
    try {
        if (window.electronAPI?.fileExists) {
            // Check via IPC - main process will resolve the full path
            const fileName = `${modelId}/model.bin`;
            const exists = await window.electronAPI.fileExists(fileName);
            if (exists) {
                console.log(`[HuggingFace] Model ${modelId} found locally`);
                return true;
            }
        }
        return false;
    }
    catch (error) {
        console.log(`[HuggingFace] Model ${modelId} not found locally`);
        return false;
    }
}
/**
 * Get HuggingFace download URL for a specific file
 */
function getDownloadUrl(model, filename) {
    return `https://huggingface.co/${model.repoId}/resolve/main/${filename}`;
}
/**
 * Download a model from HuggingFace using Electron main process
 */
export async function downloadModel(modelId, onProgress, abortSignal) {
    const model = HUGGINGFACE_MODELS[modelId];
    if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
    }
    if (!window.electronAPI?.downloadFile) {
        throw new Error('Download API not available - not running in Electron');
    }
    console.log(`[HuggingFace] Starting download of ${model.name}`);
    console.log(`[HuggingFace] Files to download: ${model.files.length}`);
    console.log(`[HuggingFace] Total expected size: ${(model.expectedSize / 1024 / 1024 / 1024).toFixed(1)} GB`);
    let totalDownloaded = 0;
    const startTime = Date.now();
    // Download each file sequentially
    for (let i = 0; i < model.files.length; i++) {
        const filename = model.files[i];
        const url = getDownloadUrl(model, filename);
        const fileName = `${modelId}/${filename}`;
        const downloadId = `download_${modelId}_${i}_${Date.now()}`;
        console.log(`[HuggingFace] Downloading file ${i + 1}/${model.files.length}: ${filename}`);
        console.log(`[HuggingFace] URL: ${url}`);
        if (abortSignal?.aborted) {
            throw new Error('Download cancelled by user');
        }
        // Download this file
        await new Promise((resolve, reject) => {
            let isAborted = false;
            // Handle abort signal
            if (abortSignal) {
                const abortHandler = () => {
                    isAborted = true;
                    window.electronAPI.cancelDownload(downloadId);
                    reject(new Error('Download cancelled by user'));
                };
                if (abortSignal.aborted) {
                    abortHandler();
                    return;
                }
                abortSignal.addEventListener('abort', abortHandler);
            }
            // Set up progress listener for this file
            const progressHandler = (id, fileProgress) => {
                if (id === downloadId && !isAborted) {
                    // Calculate total progress across all files
                    const totalProgress = {
                        downloaded: totalDownloaded + fileProgress.downloaded,
                        total: model.expectedSize,
                        percentage: ((totalDownloaded + fileProgress.downloaded) / model.expectedSize) * 100,
                        speed: fileProgress.speed,
                        eta: (model.expectedSize - totalDownloaded - fileProgress.downloaded) / fileProgress.speed
                    };
                    onProgress(totalProgress);
                    // Log progress periodically
                    if (fileProgress.downloaded % (100 * 1024 * 1024) < 1024 * 1024) { // Every ~100MB
                        const speedMBps = (fileProgress.speed / 1024 / 1024).toFixed(1);
                        const etaMin = Math.round(totalProgress.eta / 60);
                        console.log(`[HuggingFace] File ${i + 1}/${model.files.length} - Downloaded ${(fileProgress.downloaded / 1024 / 1024).toFixed(0)}MB - Total: ${totalProgress.percentage.toFixed(1)}% - ${speedMBps} MB/s - ETA: ${etaMin}min`);
                    }
                }
            };
            // Set up completion listener
            const completeHandler = (id) => {
                if (id === downloadId && !isAborted) {
                    console.log(`[HuggingFace] Completed file ${i + 1}/${model.files.length}: ${filename}`);
                    resolve();
                }
            };
            // Set up error listener
            const errorHandler = (id, error) => {
                if (id === downloadId && !isAborted) {
                    console.error(`[HuggingFace] Download failed for file ${filename}:`, error);
                    reject(new Error(`Download failed: ${error}`));
                }
            };
            // Register event listeners
            window.electronAPI.onDownloadProgress(progressHandler);
            window.electronAPI.onDownloadComplete(completeHandler);
            window.electronAPI.onDownloadError(errorHandler);
            // Start the download
            window.electronAPI.downloadFile(downloadId, url, fileName)
                .catch((error) => {
                if (!isAborted) {
                    console.error(`[HuggingFace] Download initiation failed for ${filename}:`, error);
                    reject(error);
                }
            });
        });
        // Update total downloaded (estimated - we don't know exact file sizes)
        totalDownloaded += model.expectedSize / model.files.length;
    }
    console.log(`[HuggingFace] All files downloaded successfully for ${model.name}`);
}
/**
 * Download manager for handling multiple downloads
 */
export class DownloadManager {
    static startDownload(modelId, onProgress) {
        // Cancel any existing download for this model
        this.cancelDownload(modelId);
        // Create new abort controller
        const abortController = new AbortController();
        this.downloads.set(modelId, abortController);
        // Start download
        return downloadModel(modelId, onProgress, abortController.signal)
            .finally(() => {
            this.downloads.delete(modelId);
        });
    }
    static cancelDownload(modelId) {
        const controller = this.downloads.get(modelId);
        if (controller) {
            controller.abort();
            this.downloads.delete(modelId);
            console.log(`[HuggingFace] Cancelled download: ${modelId}`);
        }
    }
    static isDownloading(modelId) {
        return this.downloads.has(modelId);
    }
}
Object.defineProperty(DownloadManager, "downloads", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Map()
});
/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
/**
 * Format seconds to human readable time
 */
export function formatTime(seconds) {
    if (seconds < 60)
        return `${Math.round(seconds)}s`;
    if (seconds < 3600)
        return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

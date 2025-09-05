interface ProcessOptions {
    maxTokens?: number;
    temperature?: number;
    contextWindow?: number;
    enableMemory?: boolean;
}
interface ProcessedResponse {
    response: string;
    confidence: number;
    memoryUpdated: boolean;
    characterId: string;
    userId: string;
    metadata?: Record<string, any>;
}
interface RuntimeHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    charactersLoaded: number;
    memoryConnected: boolean;
    lastHealthCheck: string;
    errors?: string[];
}
export declare class RealElizaRuntimeManager {
    private runtimes;
    private characters;
    private memoryManager;
    private databaseAdapter;
    private startTime;
    private errors;
    constructor();
    initialize(): Promise<void>;
    private initializeDatabase;
    private loadCharacters;
    private transformMessageExamples;
    private initializeRuntimes;
    processMessage(userId: string, characterId: string, message: string, options?: ProcessOptions): Promise<ProcessedResponse>;
    getCharacterStatus(characterId: string): Promise<any>;
    getHealthStatus(): Promise<RuntimeHealth>;
    getAllCharacters(): Promise<string[]>;
    shutdown(): Promise<void>;
}
export {};

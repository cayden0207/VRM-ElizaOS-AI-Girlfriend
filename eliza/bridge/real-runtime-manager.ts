import { 
  AgentRuntime, 
  Character, 
  elizaLogger,
  composeContext, 
  generateMessageResponse,
  MemoryManager,
  generateText,
  ModelProviderName,
  getModel,
  stringToUuid,
  UUID,
  State,
  Message,
  Content,
  Goal,
  Objective,
  Actor,
  type IAgentRuntime,
  type ICacheManager,
  type IDatabaseAdapter,
  type IMemoryManager
} from '@ai16z/eliza';
import { createSupabaseAdapter } from '../database/supabase-adapter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export class RealElizaRuntimeManager {
  private runtimes: Map<string, IAgentRuntime> = new Map();
  private characters: Map<string, Character> = new Map();
  private memoryManager: IMemoryManager | null = null;
  private databaseAdapter: IDatabaseAdapter | null = null;
  private startTime: number;
  private errors: string[] = [];

  constructor() {
    this.startTime = Date.now();
    elizaLogger.info('Real ElizaOS Runtime Manager initializing...');
  }

  async initialize(): Promise<void> {
    try {
      elizaLogger.info('Initializing Real ElizaOS Runtime Manager');

      // 1. Initialize database adapter
      await this.initializeDatabase();
      
      // 2. Load characters
      await this.loadCharacters();
      
      // 3. Initialize runtimes for each character
      await this.initializeRuntimes();

      elizaLogger.success(`Real ElizaOS Runtime Manager initialized with ${this.characters.size} characters`);
    } catch (error) {
      const errorMsg = `Failed to initialize Real ElizaOS Runtime Manager: ${error}`;
      this.errors.push(errorMsg);
      elizaLogger.error(errorMsg);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Use Supabase adapter
      this.databaseAdapter = await createSupabaseAdapter();
      
      // Initialize memory manager with database adapter
      if (this.databaseAdapter) {
        this.memoryManager = new MemoryManager({
          runtime: null as any, // Will be set per runtime
          tableName: 'memories'
        });
      }
      
      elizaLogger.info('Database adapter initialized');
    } catch (error) {
      elizaLogger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async loadCharacters(): Promise<void> {
    const charactersDir = path.join(__dirname, '../characters');
    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(charactersDir, file);
        const characterData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Transform to ElizaOS Character format
        const character: Character = {
          id: stringToUuid(characterData.name) as UUID,
          name: characterData.name,
          username: characterData.name,
          system: characterData.bio?.join(' ') || '',
          bio: characterData.lore || [],
          lore: characterData.lore || [],
          messageExamples: this.transformMessageExamples(characterData.messageExamples || []),
          postExamples: characterData.postExamples || [],
          topics: characterData.topics || [],
          adjectives: characterData.adjectives || [],
          people: characterData.people || [],
          clients: [],
          plugins: [],
          settings: {
            model: characterData.settings?.model || "openai:gpt-3.5-turbo",
            embeddingModel: characterData.settings?.embeddingModel || "text-embedding-3-small",
            voice: characterData.settings?.voice || {},
            secrets: {},
            intiface: false,
            imageVisionModel: "gpt-4o-mini",
            chains: {}
          },
          style: {
            all: characterData.style?.all || [],
            chat: characterData.style?.chat || [],
            post: characterData.style?.post || []
          },
          templates: {}
        };

        this.characters.set(characterData.name, character);
        elizaLogger.info(`Loaded character: ${characterData.name}`);
      } catch (error) {
        elizaLogger.error(`Failed to load character ${file}:`, error);
        this.errors.push(`Failed to load character ${file}: ${error}`);
      }
    }
  }

  private transformMessageExamples(examples: any[]): any[] {
    return examples.map(example => {
      if (Array.isArray(example)) {
        return example.map(msg => ({
          user: msg.user,
          content: {
            text: msg.content?.text || msg.content || '',
            action: msg.content?.action,
            source: msg.content?.source
          }
        }));
      }
      return example;
    });
  }

  private async initializeRuntimes(): Promise<void> {
    for (const [characterId, character] of this.characters) {
      try {
        // Create runtime for this character
        const runtime = new AgentRuntime({
          databaseAdapter: this.databaseAdapter!,
          token: process.env.OPENAI_API_KEY || '',
          modelProvider: character.settings.model.split(':')[0] as ModelProviderName,
          character,
          plugins: [],
          providers: [],
          actions: [],
          evaluators: [],
          services: []
        });

        this.runtimes.set(characterId, runtime);
        elizaLogger.info(`Initialized runtime for character: ${characterId}`);
      } catch (error) {
        elizaLogger.error(`Failed to initialize runtime for ${characterId}:`, error);
        this.errors.push(`Failed to initialize runtime for ${characterId}: ${error}`);
      }
    }
  }

  async processMessage(
    userId: string, 
    characterId: string, 
    message: string, 
    options: ProcessOptions = {}
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();
    
    try {
      const runtime = this.runtimes.get(characterId);
      const character = this.characters.get(characterId);
      
      if (!runtime || !character) {
        throw new Error(`Character ${characterId} not found or runtime not initialized`);
      }

      // Create user UUID
      const userUUID = stringToUuid(userId) as UUID;
      const characterUUID = stringToUuid(characterId) as UUID;
      const messageUUID = stringToUuid(`${userId}-${Date.now()}`) as UUID;
      const roomUUID = stringToUuid(`${userId}-${characterId}`) as UUID;

      // Create message content
      const content: Content = {
        text: message,
        source: 'direct',
        url: undefined,
        inReplyTo: undefined,
        attachments: []
      };

      // Create message object
      const messageObj: Message = {
        id: messageUUID,
        userId: userUUID,
        content,
        roomId: roomUUID,
        createdAt: new Date().toISOString()
      };

      // Create state for processing
      const state: State = {
        userId: userUUID,
        roomId: roomUUID,
        bio: character.bio,
        lore: character.lore,
        messageDirections: character.messageExamples || [],
        postDirections: character.postExamples || [],
        actors: [],
        goals: [],
        recentMessages: [],
        recentMessagesData: []
      };

      // Generate response using ElizaOS
      const response = await generateMessageResponse({
        runtime,
        message: messageObj,
        state,
        context: await composeContext({
          state,
          template: runtime.character.templates?.messageHandlerTemplate || 
                   "{{recentMessages}}\n\nRespond as {{agentName}} in character. Keep responses concise and natural."
        })
      });

      // Process the response
      let responseText = '';
      if (response && typeof response === 'object' && 'text' in response) {
        responseText = response.text as string;
      } else if (typeof response === 'string') {
        responseText = response;
      } else {
        responseText = 'I understand, but I need a moment to process that.';
      }

      const processingTime = Date.now() - startTime;
      elizaLogger.info(`Processed message for ${characterId} in ${processingTime}ms`);

      return {
        response: responseText,
        confidence: 0.9, // ElizaOS doesn't provide confidence scores directly
        memoryUpdated: options.enableMemory !== false,
        characterId,
        userId,
        metadata: {
          processingTime,
          model: character.settings.model,
          tokenCount: Math.ceil(message.length / 4) // Rough estimate
        }
      };

    } catch (error) {
      elizaLogger.error(`Error processing message for ${characterId}:`, error);
      
      // Return fallback response
      return {
        response: "I'm having trouble processing that right now. Could you try again?",
        confidence: 0.1,
        memoryUpdated: false,
        characterId,
        userId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  async getCharacterStatus(characterId: string): Promise<any> {
    const runtime = this.runtimes.get(characterId);
    const character = this.characters.get(characterId);
    
    if (!runtime || !character) {
      return { status: 'not_found', characterId };
    }

    return {
      status: 'active',
      characterId,
      name: character.name,
      model: character.settings.model,
      memoryEnabled: this.memoryManager !== null,
      uptime: Date.now() - this.startTime,
      lastActivity: Date.now()
    };
  }

  async getHealthStatus(): Promise<RuntimeHealth> {
    return {
      status: this.errors.length === 0 ? 'healthy' : (this.errors.length < 3 ? 'degraded' : 'unhealthy'),
      uptime: Date.now() - this.startTime,
      charactersLoaded: this.characters.size,
      memoryConnected: this.databaseAdapter !== null,
      lastHealthCheck: new Date().toISOString(),
      errors: this.errors.slice(-5) // Last 5 errors
    };
  }

  async getAllCharacters(): Promise<string[]> {
    return Array.from(this.characters.keys());
  }

  async shutdown(): Promise<void> {
    elizaLogger.info('Shutting down Real ElizaOS Runtime Manager...');
    
    // Clean up runtimes
    for (const [characterId, runtime] of this.runtimes) {
      try {
        // ElizaOS runtimes don't have explicit cleanup, but we can clear references
        elizaLogger.info(`Cleaned up runtime for ${characterId}`);
      } catch (error) {
        elizaLogger.error(`Error cleaning up runtime for ${characterId}:`, error);
      }
    }
    
    this.runtimes.clear();
    this.characters.clear();
    
    elizaLogger.info('Real ElizaOS Runtime Manager shutdown complete');
  }
}
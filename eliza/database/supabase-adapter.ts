import { 
  IDatabaseAdapter, 
  UUID, 
  Account, 
  Actor, 
  GoalStatus, 
  Goal, 
  Memory, 
  Relationship, 
  Room, 
  Participant,
  elizaLogger
} from '@ai16z/eliza';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseDatabaseAdapter implements IDatabaseAdapter {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    elizaLogger.info('Supabase adapter initialized');
  }

  async getRoom(roomId: UUID): Promise<Room | null> {
    try {
      const { data, error } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (error) {
        elizaLogger.error('Error fetching room:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      elizaLogger.error('Error in getRoom:', error);
      return null;
    }
  }

  async createRoom(roomId: UUID): Promise<UUID> {
    try {
      const room: Room = {
        id: roomId,
        createdAt: Date.now()
      };
      
      const { error } = await this.supabase
        .from('rooms')
        .insert(room);
      
      if (error) {
        elizaLogger.error('Error creating room:', error);
        throw error;
      }
      
      return roomId;
    } catch (error) {
      elizaLogger.error('Error in createRoom:', error);
      throw error;
    }
  }

  async getParticipantsForAccount(userId: UUID): Promise<Participant[]> {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select('*')
        .eq('userId', userId);
      
      if (error) {
        elizaLogger.error('Error fetching participants:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      elizaLogger.error('Error in getParticipantsForAccount:', error);
      return [];
    }
  }

  async getParticipantUserState(roomId: UUID, userId: UUID): Promise<"FOLLOWED" | "MUTED" | null> {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select('userState')
        .eq('roomId', roomId)
        .eq('userId', userId)
        .single();
      
      if (error) {
        return null;
      }
      
      return data?.userState || null;
    } catch (error) {
      elizaLogger.error('Error in getParticipantUserState:', error);
      return null;
    }
  }

  async setParticipantUserState(roomId: UUID, userId: UUID, state: "FOLLOWED" | "MUTED" | null): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('participants')
        .upsert({
          roomId,
          userId,
          userState: state,
          joinedAt: Date.now()
        });
      
      if (error) {
        elizaLogger.error('Error setting participant state:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in setParticipantUserState:', error);
      throw error;
    }
  }

  async getMemories(params: {
    roomId: UUID;
    count?: number;
    unique?: boolean;
    tableName: string;
  }): Promise<Memory[]> {
    try {
      let query = this.supabase
        .from('memories')
        .select('*')
        .eq('roomId', params.roomId)
        .order('createdAt', { ascending: false });

      if (params.count) {
        query = query.limit(params.count);
      }

      const { data, error } = await query;
      
      if (error) {
        elizaLogger.error('Error fetching memories:', error);
        return [];
      }
      
      let memories = data || [];
      
      // Apply unique filter if requested
      if (params.unique) {
        const seen = new Set();
        memories = memories.filter(memory => {
          const key = `${memory.userId}-${memory.content.text}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      
      return memories;
    } catch (error) {
      elizaLogger.error('Error in getMemories:', error);
      return [];
    }
  }

  async searchMemories(params: {
    tableName: string;
    roomId: UUID;
    embedding: number[];
    match_threshold: number;
    match_count: number;
    unique?: boolean;
  }): Promise<Memory[]> {
    try {
      // Use the existing match_memories function if available, otherwise fallback
      const { data, error } = await this.supabase.rpc('match_memories', {
        query_embedding: params.embedding,
        match_threshold: params.match_threshold,
        match_count: params.match_count,
        room_id: params.roomId
      });
      
      if (error) {
        elizaLogger.error('Error searching memories:', error);
        // Fallback to simple text search
        return await this.getMemories({
          roomId: params.roomId,
          count: params.match_count,
          unique: params.unique,
          tableName: params.tableName
        });
      }
      
      return data || [];
    } catch (error) {
      elizaLogger.error('Error in searchMemories:', error);
      return [];
    }
  }

  async createMemory(memory: Memory, tableName: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('memories')
        .insert({
          ...memory,
          tableName
        });
      
      if (error) {
        elizaLogger.error('Error creating memory:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in createMemory:', error);
      throw error;
    }
  }

  async removeMemory(memoryId: UUID, tableName: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('memories')
        .delete()
        .eq('id', memoryId);
      
      if (error) {
        elizaLogger.error('Error removing memory:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in removeMemory:', error);
      throw error;
    }
  }

  async removeAllMemories(roomId: UUID, tableName: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('memories')
        .delete()
        .eq('roomId', roomId);
      
      if (error) {
        elizaLogger.error('Error removing all memories:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in removeAllMemories:', error);
      throw error;
    }
  }

  async countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number> {
    try {
      let query = this.supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('roomId', roomId);

      const { count, error } = await query;
      
      if (error) {
        elizaLogger.error('Error counting memories:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      elizaLogger.error('Error in countMemories:', error);
      return 0;
    }
  }

  async getGoals(params: {
    roomId: UUID;
    userId?: UUID;
    onlyInProgress?: boolean;
    count?: number;
  }): Promise<Goal[]> {
    try {
      let query = this.supabase
        .from('goals')
        .select('*')
        .eq('roomId', params.roomId);

      if (params.userId) {
        query = query.eq('userId', params.userId);
      }
      
      if (params.onlyInProgress) {
        query = query.eq('status', GoalStatus.IN_PROGRESS);
      }
      
      if (params.count) {
        query = query.limit(params.count);
      }

      const { data, error } = await query;
      
      if (error) {
        elizaLogger.error('Error fetching goals:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      elizaLogger.error('Error in getGoals:', error);
      return [];
    }
  }

  async updateGoal(goal: Goal): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('goals')
        .update(goal)
        .eq('id', goal.id);
      
      if (error) {
        elizaLogger.error('Error updating goal:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in updateGoal:', error);
      throw error;
    }
  }

  async createGoal(goal: Goal): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('goals')
        .insert(goal);
      
      if (error) {
        elizaLogger.error('Error creating goal:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in createGoal:', error);
      throw error;
    }
  }

  async removeGoal(goalId: UUID): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('goals')
        .delete()
        .eq('id', goalId);
      
      if (error) {
        elizaLogger.error('Error removing goal:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in removeGoal:', error);
      throw error;
    }
  }

  async removeAllGoals(roomId: UUID): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('goals')
        .delete()
        .eq('roomId', roomId);
      
      if (error) {
        elizaLogger.error('Error removing all goals:', error);
        throw error;
      }
    } catch (error) {
      elizaLogger.error('Error in removeAllGoals:', error);
      throw error;
    }
  }

  async createRelationship(params: { userA: UUID; userB: UUID }): Promise<boolean> {
    try {
      const relationship: Relationship = {
        userA: params.userA,
        userB: params.userB,
        status: 'friend',
        id: `${params.userA}-${params.userB}` as UUID,
        userId: params.userA,
        roomId: '' as UUID,
        createdAt: Date.now()
      };
      
      const { error } = await this.supabase
        .from('relationships')
        .insert(relationship);
      
      if (error) {
        elizaLogger.error('Error creating relationship:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      elizaLogger.error('Error in createRelationship:', error);
      return false;
    }
  }

  async getRelationship(params: { userA: UUID; userB: UUID }): Promise<Relationship | null> {
    try {
      const { data, error } = await this.supabase
        .from('relationships')
        .select('*')
        .or(`and(userA.eq.${params.userA},userB.eq.${params.userB}),and(userA.eq.${params.userB},userB.eq.${params.userA})`)
        .single();
      
      if (error) {
        return null;
      }
      
      return data;
    } catch (error) {
      elizaLogger.error('Error in getRelationship:', error);
      return null;
    }
  }

  async getRelationships(params: { userId: UUID }): Promise<Relationship[]> {
    try {
      const { data, error } = await this.supabase
        .from('relationships')
        .select('*')
        .or(`userA.eq.${params.userId},userB.eq.${params.userId}`);
      
      if (error) {
        elizaLogger.error('Error fetching relationships:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      elizaLogger.error('Error in getRelationships:', error);
      return [];
    }
  }

  // Account management methods
  async createAccount(account: Account): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('accounts')
        .insert(account);
      
      if (error) {
        elizaLogger.error('Error creating account:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      elizaLogger.error('Error in createAccount:', error);
      return false;
    }
  }

  async getAccount(userId: UUID): Promise<Account | null> {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        return null;
      }
      
      return data;
    } catch (error) {
      elizaLogger.error('Error in getAccount:', error);
      return null;
    }
  }

  // Actor management
  async createActor(actor: Actor): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('actors')
        .insert(actor);
      
      if (error) {
        elizaLogger.error('Error creating actor:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      elizaLogger.error('Error in createActor:', error);
      return false;
    }
  }

  async getActor(params: { roomId: UUID; userId: UUID }): Promise<Actor | null> {
    try {
      const { data, error } = await this.supabase
        .from('actors')
        .select('*')
        .eq('id', params.userId)
        .single();
      
      if (error) {
        return null;
      }
      
      return data;
    } catch (error) {
      elizaLogger.error('Error in getActor:', error);
      return null;
    }
  }
}

export async function createSupabaseAdapter(): Promise<SupabaseDatabaseAdapter> {
  const adapter = new SupabaseDatabaseAdapter();
  return adapter;
}
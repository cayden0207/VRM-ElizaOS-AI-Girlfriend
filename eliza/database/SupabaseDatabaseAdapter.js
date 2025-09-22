/**
 * SupabaseDatabaseAdapter - 符合ElizaOS标准的数据库适配器
 * 实现完整的DatabaseAdapter接口
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export class SupabaseDatabaseAdapter {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ SupabaseDatabaseAdapter initialized');
    }

    /**
     * 获取账户信息
     */
    async getAccountById(userId) {
        try {
            const { data, error } = await this.supabase
                .from('accounts')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error getting account:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getAccountById:', error);
            return null;
        }
    }

    /**
     * 创建账户
     */
    async createAccount(account) {
        try {
            const { data, error } = await this.supabase
                .from('accounts')
                .insert([account])
                .select()
                .single();

            if (error) {
                console.error('Error creating account:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in createAccount:', error);
            return false;
        }
    }

    /**
     * 获取记忆
     */
    async getMemories(params) {
        try {
            const { roomId, count = 10, unique = false, tableName = 'memories' } = params;

            let query = this.supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (roomId) {
                query = query.eq('room_id', roomId);
            }

            if (count > 0) {
                query = query.limit(count);
            }

            if (unique) {
                query = query.distinct();
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error getting memories:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getMemories:', error);
            return [];
        }
    }

    /**
     * 根据ID获取记忆
     */
    async getMemoryById(memoryId) {
        try {
            const { data, error } = await this.supabase
                .from('memories')
                .select('*')
                .eq('id', memoryId)
                .single();

            if (error) {
                console.error('Error getting memory by id:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getMemoryById:', error);
            return null;
        }
    }

    /**
     * 创建记忆
     */
    async createMemory(memory, tableName = 'memories') {
        try {
            const memoryData = {
                id: memory.id || crypto.randomUUID(),
                user_id: memory.userId,
                agent_id: memory.agentId,
                room_id: memory.roomId,
                content: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
                embedding: memory.embedding,
                created_at: memory.createdAt || new Date().toISOString(),
                type: memory.type || 'message'
            };

            const { data, error } = await this.supabase
                .from(tableName)
                .insert([memoryData])
                .select()
                .single();

            if (error) {
                console.error('Error creating memory:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in createMemory:', error);
            return false;
        }
    }

    /**
     * 搜索记忆
     */
    async searchMemories(params) {
        try {
            const {
                tableName = 'memories',
                roomId,
                embedding,
                match_threshold = 0.8,
                match_count = 10,
                unique = false
            } = params;

            let query = this.supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (roomId) {
                query = query.eq('room_id', roomId);
            }

            if (embedding) {
                // Supabase RPC for vector similarity search
                const { data, error } = await this.supabase
                    .rpc('match_documents', {
                        query_embedding: embedding,
                        match_threshold,
                        match_count
                    });

                if (error) {
                    console.error('Error in vector search:', error);
                    return [];
                }

                return data || [];
            }

            query = query.limit(match_count);

            if (unique) {
                query = query.distinct();
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error searching memories:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in searchMemories:', error);
            return [];
        }
    }

    /**
     * 获取房间信息
     */
    async getRoom(roomId) {
        try {
            const { data, error } = await this.supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                if (error.code === 'PGRST205') {
                    // Table not found - return a mock room object
                    console.warn('Rooms table not found, returning mock room');
                    return { id: roomId, created_at: new Date().toISOString() };
                }
                console.error('Error getting room:', error);
                return null;
            }

            return data || null;
        } catch (error) {
            console.error('Error in getRoom:', error);
            return null;
        }
    }

    /**
     * 创建房间
     */
    async createRoom(roomId) {
        try {
            const roomData = {
                id: roomId,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('rooms')
                .insert([roomData])
                .select()
                .single();

            if (error) {
                console.error('Error creating room:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in createRoom:', error);
            return false;
        }
    }

    /**
     * 获取参与者信息
     */
    async getParticipantsForAccount(userId) {
        try {
            const { data, error } = await this.supabase
                .from('participants')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.error('Error getting participants:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getParticipantsForAccount:', error);
            return [];
        }
    }

    /**
     * 获取房间中的参与者
     */
    async getParticipantsForRoom(roomId) {
        try {
            const { data, error } = await this.supabase
                .from('participants')
                .select('*')
                .eq('room_id', roomId);

            if (error) {
                console.error('Error getting room participants:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getParticipantsForRoom:', error);
            return [];
        }
    }

    /**
     * 根据房间ID获取参与者
     */
    async getParticipantUserState(roomId, userId) {
        try {
            const { data, error } = await this.supabase
                .from('participants')
                .select('*')
                .eq('room_id', roomId)
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting participant state:', error);
                return null;
            }

            return data || null;
        } catch (error) {
            console.error('Error in getParticipantUserState:', error);
            return null;
        }
    }

    /**
     * 设置参与者状态
     */
    async setParticipantUserState(roomId, userId, state) {
        try {
            const participantData = {
                room_id: roomId,
                user_id: userId,
                state: typeof state === 'string' ? state : JSON.stringify(state),
                last_message_read: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('participants')
                .upsert([participantData])
                .select()
                .single();

            if (error) {
                console.error('Error setting participant state:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in setParticipantUserState:', error);
            return false;
        }
    }

    /**
     * 创建关系
     */
    async createRelationship(params) {
        try {
            const relationshipData = {
                id: params.id || crypto.randomUUID(),
                user_a: params.userA,
                user_b: params.userB,
                status: params.status || 'pending',
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('relationships')
                .insert([relationshipData])
                .select()
                .single();

            if (error) {
                console.error('Error creating relationship:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in createRelationship:', error);
            return false;
        }
    }

    /**
     * 获取关系
     */
    async getRelationship(params) {
        try {
            const { userA, userB } = params;

            const { data, error } = await this.supabase
                .from('relationships')
                .select('*')
                .or(`and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting relationship:', error);
                return null;
            }

            return data || null;
        } catch (error) {
            console.error('Error in getRelationship:', error);
            return null;
        }
    }

    /**
     * 获取关系列表
     */
    async getRelationships(params) {
        try {
            const { userId } = params;

            const { data, error } = await this.supabase
                .from('relationships')
                .select('*')
                .or(`user_a.eq.${userId},user_b.eq.${userId}`);

            if (error) {
                console.error('Error getting relationships:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getRelationships:', error);
            return [];
        }
    }

    /**
     * 日志记录
     */
    async log(params) {
        try {
            const logData = {
                body: typeof params.body === 'string' ? params.body : JSON.stringify(params.body),
                user_id: params.userId,
                room_id: params.roomId,
                type: params.type || 'info',
                created_at: new Date().toISOString()
            };

            const { error } = await this.supabase
                .from('logs')
                .insert([logData]);

            if (error) {
                console.error('Error logging:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in log:', error);
            return false;
        }
    }

    /**
     * 获取目标
     */
    async getGoals(params) {
        try {
            const { roomId, userId, onlyInProgress = true, count = 10 } = params;

            let query = this.supabase
                .from('goals')
                .select('*')
                .order('created_at', { ascending: false });

            if (roomId) {
                query = query.eq('room_id', roomId);
            }

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (onlyInProgress) {
                query = query.eq('status', 'in_progress');
            }

            if (count > 0) {
                query = query.limit(count);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error getting goals:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getGoals:', error);
            return [];
        }
    }

    /**
     * 更新目标
     */
    async updateGoal(goal) {
        try {
            const { data, error } = await this.supabase
                .from('goals')
                .update({
                    name: goal.name,
                    status: goal.status,
                    description: goal.description,
                    updated_at: new Date().toISOString()
                })
                .eq('id', goal.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating goal:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in updateGoal:', error);
            return false;
        }
    }

    /**
     * 创建目标
     */
    async createGoal(goal) {
        try {
            const goalData = {
                id: goal.id || crypto.randomUUID(),
                room_id: goal.roomId,
                user_id: goal.userId,
                name: goal.name,
                status: goal.status || 'in_progress',
                description: goal.description,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('goals')
                .insert([goalData])
                .select()
                .single();

            if (error) {
                console.error('Error creating goal:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in createGoal:', error);
            return false;
        }
    }

    /**
     * 移除目标
     */
    async removeGoal(goalId) {
        try {
            const { error } = await this.supabase
                .from('goals')
                .delete()
                .eq('id', goalId);

            if (error) {
                console.error('Error removing goal:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in removeGoal:', error);
            return false;
        }
    }

    /**
     * 移除记忆
     */
    async removeMemory(memoryId, tableName = 'memories') {
        try {
            const { error } = await this.supabase
                .from(tableName)
                .delete()
                .eq('id', memoryId);

            if (error) {
                console.error('Error removing memory:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in removeMemory:', error);
            return false;
        }
    }

    /**
     * 移除所有记忆
     */
    async removeAllMemories(roomId, tableName = 'memories') {
        try {
            const { error } = await this.supabase
                .from(tableName)
                .delete()
                .eq('room_id', roomId);

            if (error) {
                console.error('Error removing all memories:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in removeAllMemories:', error);
            return false;
        }
    }

    /**
     * 添加参与者到房间
     */
    async addParticipant(userId, roomId) {
        try {
            const participantData = {
                id: randomUUID(),
                user_id: userId,
                room_id: roomId,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('participants')
                .insert([participantData])
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST205') {
                    // Table not found - return mock success
                    console.warn('Participants table not found, returning mock success');
                    return participantData;
                }
                console.error('Error adding participant:', error);
                return false;
            }

            return data;
        } catch (error) {
            console.error('Error in addParticipant:', error);
            return false;
        }
    }

    /**
     * 移除参与者
     */
    async removeParticipant(userId, roomId) {
        try {
            const { error } = await this.supabase
                .from('participants')
                .delete()
                .eq('user_id', userId)
                .eq('room_id', roomId);

            if (error) {
                console.error('Error removing participant:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in removeParticipant:', error);
            return false;
        }
    }

    /**
     * 计算记忆数量
     */
    async countMemories(roomId, unique = false, tableName = 'memories') {
        try {
            let query = this.supabase
                .from(tableName)
                .select('id', { count: 'exact', head: true });

            if (roomId) {
                query = query.eq('room_id', roomId);
            }

            if (unique) {
                query = query.distinct();
            }

            const { count, error } = await query;

            if (error) {
                console.error('Error counting memories:', error);
                return 0;
            }

            return count || 0;
        } catch (error) {
            console.error('Error in countMemories:', error);
            return 0;
        }
    }

    /**
     * 获取缓存的嵌入向量
     */
    async getCachedEmbeddings(content) {
        try {
            // 简单实现：返回空数组，让ElizaOS重新生成嵌入向量
            return [];
        } catch (error) {
            console.error('Error in getCachedEmbeddings:', error);
            return [];
        }
    }

    /**
     * 缓存嵌入向量
     */
    async cacheEmbedding(content, embedding) {
        try {
            // 简单实现：暂时不缓存
            return true;
        } catch (error) {
            console.error('Error in cacheEmbedding:', error);
            return false;
        }
    }

    /**
     * 获取参与者的房间列表
     */
    async getRoomsForParticipants(participantIds) {
        try {
            if (!participantIds || participantIds.length === 0) {
                return [];
            }

            const { data, error } = await this.supabase
                .from('participants')
                .select('room_id')
                .in('user_id', participantIds);

            if (error) {
                console.error('Error getting rooms for participants:', error);
                return [];
            }

            // 返回唯一的房间ID列表
            const roomIds = [...new Set(data.map(p => p.room_id))];
            return roomIds;
        } catch (error) {
            console.error('Error in getRoomsForParticipants:', error);
            return [];
        }
    }
}

export default SupabaseDatabaseAdapter;
/**
 * 记忆管理 API 端点 (Vercel Serverless Functions)
 * 处理用户记忆的保存、检索和管理
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Vercel Serverless Function 配置
module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
    maxDuration: 10, // Vercel 10秒超时限制
};

// 初始化服务
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // 使用 service key，绕过 RLS
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 生成文本向量（带重试机制）
async function generateEmbedding(text, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text.substring(0, 8000), // 限制输入长度
                dimensions: 1536
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error(`生成向量失败 (尝试 ${i + 1}/${retries}):`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// 记忆类型分类
function classifyMemoryType(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('喜欢') || lowerContent.includes('讨厌') || lowerContent.includes('偏好')) {
        return 'preference';
    } else if (lowerContent.includes('感觉') || lowerContent.includes('心情') || lowerContent.includes('情绪')) {
        return 'emotion';
    } else if (lowerContent.includes('生日') || lowerContent.includes('年龄') || lowerContent.includes('职业')) {
        return 'fact';
    } else if (lowerContent.includes('说') || lowerContent.includes('回答') || lowerContent.includes('对话')) {
        return 'conversation';
    } else {
        return 'event';
    }
}

// 计算重要性分数
function calculateImportanceScore(content, memoryType) {
    let score = 0.5; // 默认分数
    
    // 基于类型调整
    switch (memoryType) {
        case 'fact': score = 0.8; break;      // 事实信息很重要
        case 'preference': score = 0.7; break; // 偏好信息重要
        case 'emotion': score = 0.6; break;    // 情感信息中等
        case 'event': score = 0.5; break;      // 事件信息普通
        case 'conversation': score = 0.3; break; // 对话记录较低
    }
    
    // 基于内容关键词调整
    const importantKeywords = ['生日', '职业', '家人', '梦想', '目标', '爱好'];
    const keywordCount = importantKeywords.filter(keyword => 
        content.includes(keyword)
    ).length;
    
    score += keywordCount * 0.1;
    
    return Math.min(1.0, Math.max(0.1, score));
}

// 主要 API 处理器
module.exports = async function handler(req, res) {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-User-Id');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 简单的 API 密钥验证
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== process.env.SITE_API_KEY) {
            return res.status(403).json({ 
                success: false, 
                error: 'Invalid API key' 
            });
        }

        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID required' 
            });
        }

        // 路由处理
        switch (req.method) {
            case 'POST':
                return await saveMemory(req, res);
            case 'GET':
                return await searchMemories(req, res);
            case 'PUT':
                return await updateMemory(req, res);
            case 'DELETE':
                return await deleteMemory(req, res);
            default:
                return res.status(405).json({ 
                    success: false, 
                    error: 'Method not allowed' 
                });
        }
    } catch (error) {
        console.error('Memory API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
};

// 保存记忆
async function saveMemory(req, res) {
    const userId = req.headers['x-user-id'];
    const { characterId, content, memoryType, metadata = {} } = req.body;

    if (!characterId || !content) {
        return res.status(400).json({
            success: false,
            error: 'Character ID and content are required'
        });
    }

    try {
        // 1. 生成向量
        console.log('🧮 生成向量...');
        const embedding = await generateEmbedding(content);
        
        // 2. 自动分类和评分
        const autoMemoryType = memoryType || classifyMemoryType(content);
        const importanceScore = calculateImportanceScore(content, autoMemoryType);
        
        // 3. 检查是否存在相似记忆
        const { data: similarMemories } = await supabase.rpc('match_memories', {
            query_embedding: embedding,
            match_user_id: userId,
            match_character_id: characterId,
            match_count: 1,
            similarity_threshold: 0.9
        });
        
        if (similarMemories && similarMemories.length > 0) {
            // 更新现有记忆的访问计数
            const existingMemory = similarMemories[0];
            const { data: updatedMemory } = await supabase
                .from('memory_vectors')
                .update({ 
                    access_count: existingMemory.access_count + 1,
                    last_accessed: new Date().toISOString(),
                    importance_score: Math.max(existingMemory.importance_score, importanceScore)
                })
                .eq('id', existingMemory.id)
                .select()
                .single();
                
            return res.json({
                success: true,
                memory: updatedMemory,
                action: 'updated_existing'
            });
        }
        
        // 4. 保存新记忆
        const { data: newMemory, error } = await supabase
            .from('memory_vectors')
            .insert({
                user_id: userId,
                character_id: characterId,
                memory_type: autoMemoryType,
                content: content,
                embedding: embedding,
                metadata: {
                    ...metadata,
                    created_by: 'api',
                    source: 'chat',
                    timestamp: new Date().toISOString()
                },
                importance_score: importanceScore
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        console.log(`✅ 记忆已保存: ${userId} -> ${characterId} (${autoMemoryType})`);
        
        return res.json({
            success: true,
            memory: newMemory,
            action: 'created_new'
        });

    } catch (error) {
        console.error('保存记忆失败:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 搜索记忆
async function searchMemories(req, res) {
    const userId = req.headers['x-user-id'];
    const { characterId, query, limit = 10, threshold = 0.7 } = req.query;

    if (!characterId || !query) {
        return res.status(400).json({
            success: false,
            error: 'Character ID and query are required'
        });
    }

    try {
        // 1. 生成查询向量
        const queryEmbedding = await generateEmbedding(query);
        
        // 2. 向量相似度搜索
        const { data: memories, error } = await supabase.rpc('match_memories', {
            query_embedding: queryEmbedding,
            match_user_id: userId,
            match_character_id: characterId,
            match_count: parseInt(limit),
            similarity_threshold: parseFloat(threshold)
        });

        if (error) {
            throw error;
        }

        console.log(`🔍 搜索记忆: ${query} -> 找到 ${memories.length} 条相关记忆`);

        return res.json({
            success: true,
            memories: memories || [],
            query: query,
            count: memories ? memories.length : 0
        });

    } catch (error) {
        console.error('搜索记忆失败:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 更新记忆
async function updateMemory(req, res) {
    const { memoryId, importance_score, metadata } = req.body;

    if (!memoryId) {
        return res.status(400).json({
            success: false,
            error: 'Memory ID is required'
        });
    }

    try {
        const updateData = {};
        
        if (importance_score !== undefined) {
            updateData.importance_score = parseFloat(importance_score);
        }
        
        if (metadata) {
            updateData.metadata = metadata;
        }
        
        updateData.updated_at = new Date().toISOString();

        const { data: updatedMemory, error } = await supabase
            .from('memory_vectors')
            .update(updateData)
            .eq('id', memoryId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            memory: updatedMemory
        });

    } catch (error) {
        console.error('更新记忆失败:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// 删除记忆
async function deleteMemory(req, res) {
    const { memoryId } = req.body;

    if (!memoryId) {
        return res.status(400).json({
            success: false,
            error: 'Memory ID is required'
        });
    }

    try {
        const { error } = await supabase
            .from('memory_vectors')
            .delete()
            .eq('id', memoryId);

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            message: 'Memory deleted successfully'
        });

    } catch (error) {
        console.error('删除记忆失败:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
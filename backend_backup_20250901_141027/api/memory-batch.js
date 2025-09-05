/**
 * 批量记忆处理 API 端点
 * 用于批量保存多条记忆，提高效率
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Vercel 配置
module.exports.config = {
    api: { bodyParser: { sizeLimit: '2mb' } },
    maxDuration: 10
};

// 初始化服务
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 批量生成向量（控制并发）
async function batchGenerateEmbeddings(texts, batchSize = 3) {
    const results = [];
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const promises = batch.map(text => 
            openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text.substring(0, 8000),
                dimensions: 1536
            }).then(response => response.data[0].embedding)
        );
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        
        // 避免 API 限制，稍作延迟
        if (i + batchSize < texts.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    return results;
}

// 主处理器
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-User-Id');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // API 密钥验证
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.SITE_API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }

    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        const { memories } = req.body;
        
        if (!Array.isArray(memories) || memories.length === 0) {
            return res.status(400).json({ error: 'Memories array required' });
        }

        if (memories.length > 20) {
            return res.status(400).json({ error: 'Too many memories (max 20)' });
        }

        console.log(`📦 批量处理 ${memories.length} 条记忆 for user ${userId}`);

        // 1. 准备数据和生成向量
        const contents = memories.map(m => m.content);
        const embeddings = await batchGenerateEmbeddings(contents);
        
        // 2. 准备插入数据
        const memoryRecords = memories.map((memory, index) => ({
            user_id: userId,
            character_id: memory.characterId,
            memory_type: classifyMemoryType(memory.content),
            content: memory.content,
            embedding: embeddings[index],
            metadata: {
                batch_id: `batch_${Date.now()}`,
                created_by: 'batch_api',
                source: memory.source || 'chat',
                timestamp: new Date().toISOString(),
                ...memory.metadata
            },
            importance_score: calculateImportanceScore(
                memory.content, 
                memory.memoryType || classifyMemoryType(memory.content)
            )
        }));

        // 3. 批量插入到数据库
        const { data: savedMemories, error } = await supabase
            .from('memory_vectors')
            .insert(memoryRecords)
            .select();

        if (error) {
            console.error('批量插入失败:', error);
            throw error;
        }

        console.log(`✅ 成功批量保存 ${savedMemories.length} 条记忆`);

        return res.json({
            success: true,
            saved: savedMemories.length,
            memories: savedMemories
        });

    } catch (error) {
        console.error('批量处理记忆失败:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 辅助函数
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

function calculateImportanceScore(content, memoryType) {
    let score = 0.5;
    
    switch (memoryType) {
        case 'fact': score = 0.8; break;
        case 'preference': score = 0.7; break;
        case 'emotion': score = 0.6; break;
        case 'event': score = 0.5; break;
        case 'conversation': score = 0.3; break;
    }
    
    const importantKeywords = ['生日', '职业', '家人', '梦想', '目标', '爱好'];
    const keywordCount = importantKeywords.filter(keyword => 
        content.includes(keyword)
    ).length;
    
    score += keywordCount * 0.1;
    
    return Math.min(1.0, Math.max(0.1, score));
}
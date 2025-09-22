-- ElizaOS Database Schema for Supabase
-- 为AI女友系统创建必要的数据库表结构

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. 账户表
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    username TEXT UNIQUE,
    email TEXT,
    avatar_url TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 房间表
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 参与者表
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    state JSONB DEFAULT '{}',
    last_message_read TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, room_id)
);

-- 4. 记忆表（核心表）
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    type TEXT DEFAULT 'message',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 记忆向量表（如果需要单独的向量存储）
CREATE TABLE IF NOT EXISTS memory_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 关系表
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a TEXT NOT NULL,
    user_b TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_a, user_b)
);

-- 7. 目标表
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 日志表
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    body TEXT NOT NULL,
    user_id TEXT,
    room_id TEXT,
    type TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. AI女友专用：关系进展表
CREATE TABLE IF NOT EXISTS ai_girlfriend_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    intimacy_level INTEGER DEFAULT 1 CHECK (intimacy_level >= 1 AND intimacy_level <= 10),
    relationship_stage TEXT DEFAULT 'stranger',
    total_interactions INTEGER DEFAULT 0,
    positive_interactions INTEGER DEFAULT 0,
    negative_interactions INTEGER DEFAULT 0,
    shared_memories JSONB DEFAULT '[]',
    milestones JSONB DEFAULT '[]',
    emotional_bond INTEGER DEFAULT 0,
    trust_level INTEGER DEFAULT 0,
    communication_style TEXT DEFAULT 'polite',
    relationship_trend TEXT DEFAULT 'neutral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, character_id)
);

-- 10. AI女友专用：用户档案表
CREATE TABLE IF NOT EXISTS ai_girlfriend_user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    preferences JSONB DEFAULT '{"language": "zh-CN", "timezone": "Asia/Shanghai", "communicationStyle": "friendly"}',
    interaction_count INTEGER DEFAULT 0,
    mood TEXT DEFAULT 'neutral',
    topics JSONB DEFAULT '[]',
    personal_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_memories_room_id ON memories(room_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);

CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);

CREATE INDEX IF NOT EXISTS idx_relationships_user_a ON relationships(user_a);
CREATE INDEX IF NOT EXISTS idx_relationships_user_b ON relationships(user_b);

CREATE INDEX IF NOT EXISTS idx_goals_room_id ON goals(room_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

CREATE INDEX IF NOT EXISTS idx_ai_gf_relationships_user_id ON ai_girlfriend_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_gf_relationships_character_id ON ai_girlfriend_relationships(character_id);

CREATE INDEX IF NOT EXISTS idx_ai_gf_user_profiles_user_id ON ai_girlfriend_user_profiles(user_id);

-- 向量相似度搜索函数（如果使用pgvector）
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        memories.id,
        memories.content,
        1 - (memories.embedding <=> query_embedding) as similarity
    FROM memories
    WHERE 1 - (memories.embedding <=> query_embedding) > match_threshold
    ORDER BY memories.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- 自动更新 updated_at 时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建触发器
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_relationships_updated_at BEFORE UPDATE ON relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_gf_relationships_updated_at BEFORE UPDATE ON ai_girlfriend_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_gf_user_profiles_updated_at BEFORE UPDATE ON ai_girlfriend_user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入一些测试数据
INSERT INTO accounts (id, name, username, email) VALUES
('alice', 'Alice', 'alice', 'alice@example.com'),
('ash', 'Ash', 'ash', 'ash@example.com'),
('bobo', 'Bobo', 'bobo', 'bobo@example.com')
ON CONFLICT (username) DO NOTHING;

-- 11. 文档表 (ElizaOS需要)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. 片段表 (ElizaOS需要)
CREATE TABLE IF NOT EXISTS fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为新表创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_fragments_document_id ON fragments(document_id);
CREATE INDEX IF NOT EXISTS idx_fragments_created_at ON fragments(created_at);

-- 为新表创建触发器
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fragments_updated_at BEFORE UPDATE ON fragments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建测试房间
INSERT INTO rooms (id) VALUES
('alice'),
('ash'),
('bobo'),
('test-user-alice'),
('test-user-ash'),
('test-user-bobo')
ON CONFLICT (id) DO NOTHING;
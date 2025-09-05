-- 修复 RLS 策略以允许用户注册 (修正版)
-- 在 Supabase SQL Editor 中运行此脚本

-- 1. 首先删除现有的限制性策略
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Users can access own memories" ON memory_vectors;
DROP POLICY IF EXISTS "Users can access own chat history" ON chat_history;

-- 2. 为 users 表创建更灵活的策略

-- 允许所有人插入新用户（注册）
CREATE POLICY "Enable insert for registration" ON users
    FOR INSERT 
    WITH CHECK (true);

-- 允许所有人读取（后续可以限制）
CREATE POLICY "Enable read access for users" ON users
    FOR SELECT 
    USING (true);

-- 允许所有人更新（用于注册后的首次更新，后续可以限制）
CREATE POLICY "Enable update for users" ON users
    FOR UPDATE 
    USING (true);  -- 暂时允许所有更新，后续可以改为只允许更新自己的数据

-- 允许用户删除自己的数据（暂时禁用，避免误删）
-- CREATE POLICY "Enable delete for users" ON users
--     FOR DELETE 
--     USING (false);

-- 3. 为 memory_vectors 表创建策略
CREATE POLICY "Enable all operations for memory_vectors" ON memory_vectors
    FOR ALL 
    USING (true);  -- 暂时允许所有操作

-- 4. 为 chat_history 表创建策略
CREATE POLICY "Enable all operations for chat_history" ON chat_history
    FOR ALL 
    USING (true);  -- 暂时允许所有操作

-- 5. 验证策略是否正确创建
DO $$
BEGIN
    RAISE NOTICE '✅ RLS 策略已更新';
    RAISE NOTICE '📝 现在允许:';
    RAISE NOTICE '  - 任何人都可以注册（插入新用户）';
    RAISE NOTICE '  - 任何人都可以查询用户';
    RAISE NOTICE '  - 任何人都可以更新用户数据';
    RAISE NOTICE '  - 记忆和聊天历史表也开放访问';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 注意:';
    RAISE NOTICE '  - 这是开发/测试配置';
    RAISE NOTICE '  - 生产环境需要更严格的策略';
END $$;

-- 6. 测试查询 - 验证策略是否生效
SELECT COUNT(*) as user_count FROM users WHERE id LIKE 'wallet_%';